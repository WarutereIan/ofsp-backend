/* eslint-disable @typescript-eslint/no-var-requires */
import { Injectable, Logger } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { MarketplaceService } from '../marketplace/marketplace.service';
import { AggregationService } from '../aggregation/aggregation.service';
import { InputService } from '../input/input.service';
import { TransportService } from '../transport/transport.service';
import { UssdRequestDto } from './dto/ussd-request.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import * as bcrypt from 'bcrypt';

// ussd-builder is a CommonJS module
const UssdMenu = require('ussd-builder');

interface UssdSessionData {
  userId?: string;
  role?: string;
}

@Injectable()
export class UssdService {
  private readonly logger = new Logger(UssdService.name);
  private readonly menu: any;
  private readonly sessions: Record<string, UssdSessionData> = {};

  constructor(
    private readonly authService: AuthService,
    private readonly marketplaceService: MarketplaceService,
    private readonly aggregationService: AggregationService,
    private readonly inputService: InputService,
    private readonly transportService: TransportService,
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {
    this.menu = new UssdMenu();
    this.configureSessions();
    this.configureStates();
  }

  /**
   * Map Africa'sTalking request into ussd-builder args and run the menu.
   */
  async handleRequest(payload: UssdRequestDto): Promise<string> {
    const args = {
      sessionId: payload.sessionId,
      serviceCode: payload.serviceCode,
      phoneNumber: payload.phoneNumber,
      operator: payload.networkCode,
      text: payload.text ?? '',
    };

    try {
      const res: string = await this.menu.run(args);
      return res;
    } catch (error) {
      this.logger.error('Error while running USSD menu', error);
      // Fail gracefully for the user
      return 'END Sorry, something went wrong. Please try again later.';
    }
  }

  /**
   * Configure a simple in-memory session store for ussd-builder.
   * NOTE: For production, replace with Redis or another shared store.
   */
  private configureSessions() {
    this.menu.sessionConfig({
      start: (sessionId: string, cb?: () => void) => {
        if (!this.sessions[sessionId]) {
          this.sessions[sessionId] = {};
        }
        if (typeof cb === 'function') cb();
      },
      end: (sessionId: string, cb?: () => void) => {
        delete this.sessions[sessionId];
        if (typeof cb === 'function') cb();
      },
      set: (sessionId: string, key: string, value: any, cb?: () => void) => {
        if (!this.sessions[sessionId]) {
          this.sessions[sessionId] = {};
        }
        (this.sessions[sessionId] as any)[key] = value;
        if (typeof cb === 'function') cb();
      },
      get: (sessionId: string, key: string, cb?: (err: any, value?: any) => void) => {
        const value = (this.sessions[sessionId] as any)?.[key];
        if (typeof cb === 'function') cb(null, value);
      },
    });
  }

  /**
   * Helper to standardize navigation handling (98 = back, 99 = main) and
   * delegate all other input routing to a state-specific handler.
   *
   * Usage in a state:
   *
   * next: {
   *   '*\\d+': this.withStandardNav(async () => {
   *     const input = String(this.menu.val || '').trim();
   *     // ... custom routing logic ...
   *     return 'some.next.state';
   *   }, { back: 'some.back.state', main: 'menu.main' }),
   * }
   */
  private withStandardNav(
    handler: () => Promise<string> | string,
    opts: { back?: string; main?: string },
  ) {
    return async () => {
      const input = String(this.menu.val || '').trim();

      // Standard navigation shortcuts
      if (input === '98' && opts.back) {
        return opts.back;
      }

      if (input === '99') {
        return opts.main ?? 'menu.main';
      }

      // Delegate to state-specific handler
      return handler();
    };
  }

  /**
   * Define all USSD states using ussd-builder.
   * This is a first implementation that wires:
   * - PIN-based login (re-using existing AuthService login by phone/password)
   * - Main menu
   * - Basic My Orders listing and payment confirmation
   * - Stubs for other menus (to be expanded)
   */
  private configureStates() {
    // Start: detect whether farmer has a USSD PIN, then route accordingly
    //
    // - If user exists and has ussdPinHash -> show PIN prompt and next input goes to auth.verifyPin
    // - If user exists but has no ussdPinHash -> show PIN setup prompt and next input goes to auth.pinSetup.capture
    // - If user not found or not FARMER -> end with appropriate message
    this.menu.startState({
      run: async () => {
        const phone = this.menu.args.phoneNumber as string;

        try {
          const user = await this.prisma.user.findFirst({
            where: { phone },
          });

          if (!user) {
            this.menu.end(
              'This phone number is not registered. Please contact support.',
            );
            return;
          }

          const role = (user.role as string) || 'UNKNOWN';
          if (role !== 'FARMER') {
            this.menu.end(
              'This USSD service is only available to registered farmers.',
            );
            return;
          }

          // Flag in session whether PIN setup is required for this user
          const requiresSetup = !user.ussdPinHash;
          await this.menu.session.set('auth:pinSetupRequired', requiresSetup);

          if (requiresSetup) {
            await this.menu.session.set('auth:pinSetupUserId', user.id);
            await this.menu.session.set('auth:pinSetupPhone', phone);
            await this.menu.session.set('auth:pinAttempts', 0);

            this.menu.con(
              'Welcome to OFSP Marketplace' +
                '\nYou have not set a USSD PIN yet.' +
                '\nCreate a new 4-digit PIN to continue:' +
                '\nEnter new 4-digit PIN:',
            );
          } else {
            this.menu.con(
              'Welcome to OFSP Marketplace' + '\nEnter your 4-digit PIN:',
            );
          }
        } catch (error) {
          this.logger.error('Error in USSD start state', error);
          this.menu.end(
            'Sorry, we could not start your USSD session. Please try again later.',
          );
        }
      },
      next: {
        // Route next input based on whether PIN setup is required for this session
        '*\\d+': async () => {
          const requiresSetup = (await this.menu.session.get(
            'auth:pinSetupRequired',
          )) as boolean | undefined;
          return requiresSetup ? 'auth.pinSetup.capture' : 'auth.verifyPin';
        },
      },
    });

    /**
     * PIN verification (Case A)
     *
     * - Verify farmer's USSD PIN with bcrypt.
     * - Track and enforce max attempts (3) for incorrect PINs.
     * - On success, mark session as authenticated and display main menu.
     */
    this.menu.state('auth.verifyPin', {
      run: async () => {
        const phone = this.menu.args.phoneNumber as string;
        const pin = String(this.menu.val || '').trim();

        try {
          // Fetch user by phone for USSD-specific PIN handling
          const user = await this.prisma.user.findFirst({
            where: { phone },
          });

          if (!user) {
            this.menu.end(
              'This phone number is not registered. Please contact support.',
            );
            return;
          }

          // Only allow FARMER role on this USSD app
          const role = (user.role as string) || 'UNKNOWN';
          if (role !== 'FARMER') {
            this.menu.end(
              'This USSD service is only available to registered farmers.',
            );
            return;
          }

          // Track failed attempts per session to enforce simple lockout
          const currentAttempts =
            ((await this.menu.session.get(
              'auth:pinAttempts',
            )) as number) ?? 0;

          const isValidPin = await bcrypt
            .compare(pin, user.ussdPinHash || '')
            .catch(() => false);

          if (!isValidPin) {
            const nextAttempts = currentAttempts + 1;
            await this.menu.session.set(
              'auth:pinAttempts',
              nextAttempts,
            );

            if (nextAttempts >= 3) {
              this.menu.end(
                'Too many incorrect attempts. Please contact support or reset your PIN.',
              );
              return;
            }

            // Mark as not verified for retry routing
            await this.menu.session.set('auth:pinVerified', false);

            this.menu.con(
              'Invalid PIN. Please try again:\n' +
                'Enter your 4-digit PIN:',
            );
            return;
          }

          // Reset failed attempts on success
          await this.menu.session.set('auth:pinAttempts', 0);

          // Mark session as authenticated
          await this.menu.session.set('auth:pinVerified', true);

          // Update last login timestamp for analytics/consistency
          await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });

          await this.menu.session.set('userId', user.id);
          await this.menu.session.set('role', role);

          // Display main menu (don't use menu.go, let next handle routing)
          this.menu.con(
            'OFSP Menu' +
              '\n1. My Orders' +
              '\n2. Pickups & Delivery' +
              '\n3. Market Info & Prices' +
              '\n4. Buyer Requests' +
              '\n5. Advisories' +
              '\n6. My Stock / Inventory' +
              '\n0. Exit',
          );
        } catch (error) {
          this.logger.error('Error verifying USSD PIN', error);
          this.menu.end(
            'Sorry, we could not verify your PIN. Please try again later.',
          );
        }
      },
      next: {
        // Route based on whether PIN was verified
        '*\\d+': async () => {
          const pinVerified = await this.menu.session.get('auth:pinVerified');
          if (!pinVerified) {
            return 'auth.verifyPin'; // Retry PIN entry
          }
          // PIN verified - route to menu options
          const input = String(this.menu.val || '').trim();
          const menuRoutes: Record<string, string> = {
            '1': 'orders.menu',
            '2': 'pickups.menu',
            '3': 'market.menu',
            '4': 'rfq.menu',
            '5': 'advisories.menu',
            '6': 'inventory.menu',
            '0': 'session.exit',
          };
          return menuRoutes[input] || 'menu.main';
        },
      },
    });

    // PIN setup (Case B)
    //
    // auth.pinSetup.capture -> capture and validate first PIN entry
    // auth.pinSetup.confirm -> confirm PIN, persist hash, then go directly to main menu
    this.menu.state('auth.pinSetup.capture', {
      run: async () => {
        const rawPin = String(this.menu.val || '').trim();

        // Validate 4-digit numeric PIN
        if (!/^\d{4}$/.test(rawPin)) {
          this.menu.con(
            'PIN must be exactly 4 digits.' +
              '\nEnter new 4-digit PIN:',
          );
          // Mark as invalid so next routes back to this state
          await this.menu.session.set('auth:pinValid', false);
          return;
        }

        await this.menu.session.set('auth:newPin', rawPin);
        await this.menu.session.set('auth:pinValid', true);

        this.menu.con(
          'Confirm your new 4-digit PIN:' +
            '\nRe-enter PIN:',
        );
      },
      next: {
        // Route based on whether PIN was valid
        '*\\d+': async () => {
          const pinValid = await this.menu.session.get('auth:pinValid');
          return pinValid ? 'auth.pinSetup.confirm' : 'auth.pinSetup.capture';
        },
      },
    });

    this.menu.state('auth.pinSetup.confirm', {
      run: async () => {
        const confirmPin = String(this.menu.val || '').trim();

        const firstPin = (await this.menu.session.get(
          'auth:newPin',
        )) as string | undefined;
        const userId = (await this.menu.session.get(
          'auth:pinSetupUserId',
        )) as string | undefined;

        if (!firstPin || !userId) {
          // Something went wrong in the flow; restart login
          this.menu.goStart();
          return;
        }

        if (firstPin !== confirmPin) {
          // Clear stored PIN and ask user to start over
          await this.menu.session.set('auth:newPin', null);
          await this.menu.session.set('auth:pinValid', false);
          await this.menu.session.set('auth:pinVerified', false);

          this.menu.con(
            'PINs do not match. Please try again.' +
              '\nEnter new 4-digit PIN:',
          );
          return;
        }

        try {
          // Hash and persist the new USSD PIN
          const hash = await bcrypt.hash(firstPin, 10);

          const user = await this.prisma.user.update({
            where: { id: userId },
            data: {
              ussdPinHash: hash,
              lastLogin: new Date(),
            },
          });

          // Clear temporary session values and mark as authenticated
          await this.menu.session.set('auth:newPin', null);
          await this.menu.session.set('auth:pinValid', null);
          await this.menu.session.set('auth:pinSetupRequired', false);
          await this.menu.session.set('auth:pinVerified', true);

          const role = (user.role as string) || 'UNKNOWN';
          if (role !== 'FARMER') {
            this.menu.end(
              'This USSD service is only available to registered farmers.',
            );
            return;
          }

          await this.menu.session.set('userId', user.id);
          await this.menu.session.set('role', role);

          // TODO: Optional confirmation SMS via existing notification/SMS service

          // Display main menu directly (let next handle routing)
          this.menu.con(
            'PIN set successfully!' +
              '\n\nOFSP Menu' +
              '\n1. My Orders' +
              '\n2. Pickups & Delivery' +
              '\n3. Market Info & Prices' +
              '\n4. Buyer Requests' +
              '\n5. Advisories' +
              '\n6. My Stock / Inventory' +
              '\n0. Exit',
          );
        } catch (error) {
          this.logger.error('Error setting USSD PIN for user', error);
          this.menu.end(
            'We could not set your PIN at this time. Please try again later.',
          );
        }
      },
      next: {
        // Route based on whether PIN setup succeeded
        '*\\d+': async () => {
          const pinVerified = await this.menu.session.get('auth:pinVerified');
          if (!pinVerified) {
            return 'auth.pinSetup.capture'; // Mismatch, go back to capture
          }
          // PIN setup succeeded - route to menu options
          const input = String(this.menu.val || '').trim();
          const menuRoutes: Record<string, string> = {
            '1': 'orders.menu',
            '2': 'pickups.menu',
            '3': 'market.menu',
            '4': 'rfq.menu',
            '5': 'advisories.menu',
            '6': 'inventory.menu',
            '0': 'session.exit',
          };
          return menuRoutes[input] || 'menu.main';
        },
      },
    });

    // Main menu
    this.menu.state('menu.main', {
      run: () => {
        this.menu.con(
          'OFSP Menu' +
            '\n1. My Orders' +
            '\n2. Pickups & Delivery' +
            '\n3. Market Info & Prices' +
            '\n4. Buyer Requests' +
            '\n5. Advisories' +
            '\n6. My Stock / Inventory' +
            '\n0. Exit',
        );
      },
      next: {
        '1': 'orders.menu',
        '2': 'pickups.menu',
        '3': 'market.menu',
        '4': 'rfq.menu',
        '5': 'advisories.menu',
        '6': 'inventory.menu',
        '0': 'session.exit',
        // Default: redisplay main menu
        '*\\d+': 'menu.main',
        '': 'menu.main',
      },
    });

    this.menu.state('session.exit', {
      run: () => {
        this.menu.end('Thank you for using OFSP Marketplace.');
      },
    });

    /**
     * My Orders:
     * - List recent orders for the authenticated farmer (with pagination)
     * - View details (including buyer and grade)
     * - Accept / reject ORDER_PLACED
     * - View pickup details for ORDER_ACCEPTED (if available)
     * - Confirm payment for PAYMENT_SECURED orders
     */
    this.menu.state('orders.menu', {
      run: async () => {
        const userId = await this.menu.session.get('userId');

        if (!userId) {
          this.menu.goStart();
          return;
        }

        try {
          let orders = (await this.menu.session.get(
            'orders:list',
          )) as any[];

          if (!orders) {
            orders = await this.marketplaceService.getOrders({
              farmerId: userId,
            });
            await this.menu.session.set('orders:list', orders);
            await this.menu.session.set('orders:offset', 0);
          }

          if (!orders || orders.length === 0) {
            this.menu.con(
              'You have no orders at the moment.' +
                '\n\n98. Back  99. Main',
            );
            return;
          }

          const pageSize = 5;
          let offset =
            ((await this.menu.session.get(
              'orders:offset',
            )) as number) ?? 0;
          if (offset < 0 || offset >= orders.length) {
            offset = 0;
          }

          const pageItems = orders.slice(offset, offset + pageSize);

          const lines: string[] = ['My Orders'];
          for (let i = 0; i < pageItems.length; i++) {
            const o = pageItems[i];
            const price = o.pricePerKg ?? 0;
            const qty = o.quantity ?? 0;
            const status = o.status ?? '';
            lines.push(
              `${i + 1}. #${o.orderNumber} - ${qty}kg @ ${price}/kg - ${status}`,
            );
          }

          const hasMore = offset + pageSize < orders.length;
          if (hasMore) {
            lines.push('6. More');
          }
          lines.push('98. Back  99. Main');

          // Store page info for routing
          await this.menu.session.set('orders:pageSize', pageItems.length);
          await this.menu.session.set('orders:hasMore', hasMore);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching orders for USSD', error);
          this.menu.end('Unable to fetch your orders. Please try again later.');
        }
      },
      // Explicit static routing here to avoid any ambiguity between
      // order selections and the "More" option.
      next: {
        '1': 'orders.view',
        '2': 'orders.view',
        '3': 'orders.view',
        '4': 'orders.view',
        '5': 'orders.view',
        '6': 'orders.more',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'orders.menu',
      },
    });

    // "More" for orders list
    this.menu.state('orders.more', {
      run: async () => {
        const orders = (await this.menu.session.get(
          'orders:list',
        )) as any[];

        if (!orders || orders.length === 0) {
          this.menu.go('orders.menu');
          return;
        }

        const pageSize = 5;
        let offset =
          ((await this.menu.session.get(
            'orders:offset',
          )) as number) ?? 0;
        offset += pageSize;
        if (offset >= orders.length) {
          offset = 0;
        }
        await this.menu.session.set('orders:offset', offset);
        this.menu.go('orders.menu');
      },
      // Must have explicit routing since this state uses go() to display content
      next: {
        '1': 'orders.view',
        '2': 'orders.view',
        '3': 'orders.view',
        '4': 'orders.view',
        '5': 'orders.view',
        '6': 'orders.more',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'orders.menu',
      },
    });

    this.menu.state('orders.view', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const orders = (await this.menu.session.get(
          'orders:list',
        )) as any[];
        const offset =
          ((await this.menu.session.get(
            'orders:offset',
          )) as number) ?? 0;
        const pageSize = (await this.menu.session.get('orders:pageSize')) as number || 5;

        // Validate selection is within current page
        if (
          !orders ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > pageSize
        ) {
          this.menu.con('Invalid selection.\n\n98. Back  99. Main');
          await this.menu.session.set('orders:viewError', true);
          return;
        }

        const globalIndex = offset + (choice - 1);
        if (globalIndex < 0 || globalIndex >= orders.length) {
          this.menu.con('Invalid selection.\n\n98. Back  99. Main');
          await this.menu.session.set('orders:viewError', true);
          return;
        }

        await this.menu.session.set('orders:viewError', false);

        const order = orders[globalIndex];
        const lines: string[] = [];
        const buyerProfile = order.buyer?.profile;
        const buyerName = buyerProfile
          ? `${buyerProfile.firstName} ${buyerProfile.lastName}`
          : order.buyer?.email || order.buyer?.phone || '-';

        lines.push(`Order: #${order.orderNumber}`);
        lines.push(`Buyer: ${buyerName}`);
        lines.push(`Variety: ${order.variety || '-'}`);
        lines.push(`Grade: ${order.qualityGrade || '-'}`);
        lines.push(`Qty: ${order.quantity || 0} kg`);
        lines.push(`Price: ${order.pricePerKg || 0}/kg`);
        lines.push(`Amount: ${order.totalAmount || 0}`);
        lines.push(`Status: ${order.status}`);

        // Show options based on status
        if (order.status === 'ORDER_ACCEPTED') {
          lines.push('');
          lines.push('1. View pickup details');
        } else if (order.status === 'ORDER_PLACED') {
          lines.push('');
          lines.push('1. Accept order');
          lines.push('2. Reject order');
        } else if (order.status === 'PAYMENT_SECURED') {
          lines.push('');
          lines.push('1. Confirm payment received');
        }

        lines.push('98. Back  99. Main');

        this.menu.con(lines.join('\n'));

        // Store selected order in session for routing
        await this.menu.session.set('orders:selectedId', order.id);
        await this.menu.session.set('orders:selectedOrder', order);
        await this.menu.session.set('orders:selectedStatus', order.status);
      },
      next: {
        '1': async () => {
          const error = await this.menu.session.get('orders:viewError');
          if (error) return 'orders.menu';
          const status = await this.menu.session.get('orders:selectedStatus');
          if (status === 'ORDER_ACCEPTED') return 'orders.pickupDetails';
          if (status === 'ORDER_PLACED') return 'orders.accept';
          if (status === 'PAYMENT_SECURED') return 'orders.confirmPayment';
          return 'orders.menu';
        },
        '2': async () => {
          const error = await this.menu.session.get('orders:viewError');
          if (error) return 'orders.menu';
          const status = await this.menu.session.get('orders:selectedStatus');
          if (status === 'ORDER_PLACED') return 'orders.reject';
          return 'orders.view'; // Invalid for this status
        },
        '98': 'orders.menu',
        '99': 'menu.main',
        '*\\d+': 'orders.menu',
      },
    });

    this.menu.state('orders.confirmPayment', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const orderId = await this.menu.session.get(
          'orders:selectedId',
        );
        const userId = await this.menu.session.get('userId');

        if (!orderId || !userId) {
          this.menu.goStart();
          return;
        }

        try {
          // In current implementation, farmer confirms payment -> PAYMENT_CONFIRMED_BY_FARMER
          await this.marketplaceService.updateOrderStatus(
            orderId,
            { status: 'PAYMENT_CONFIRMED_BY_FARMER' as any },
            userId,
          );
          this.menu.end(
            'Thank you. Your payment confirmation has been recorded.',
          );
        } catch (error) {
          this.logger.error('Error confirming payment via USSD', error);
          this.menu.end(
            'We could not confirm the payment at this time. Please try again later.',
          );
        }
      },
    });

    // Accept ORDER_PLACED
    this.menu.state('orders.accept', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const orderId = await this.menu.session.get(
          'orders:selectedId',
        );
        const userId = await this.menu.session.get('userId');

        if (!orderId || !userId) {
          this.menu.goStart();
          return;
        }

        try {
          await this.marketplaceService.updateOrderStatus(
            orderId,
            { status: 'ORDER_ACCEPTED' as any },
            userId,
          );
          this.menu.end('Order accepted successfully.');
        } catch (error) {
          this.logger.error('Error accepting order via USSD', error);
          this.menu.end(
            'We could not accept this order. Please try again later.',
          );
        }
      },
    });

    // Reject ORDER_PLACED
    this.menu.state('orders.reject', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const orderId = await this.menu.session.get(
          'orders:selectedId',
        );
        const userId = await this.menu.session.get('userId');

        if (!orderId || !userId) {
          this.menu.goStart();
          return;
        }

        try {
          await this.marketplaceService.updateOrderStatus(
            orderId,
            { status: 'ORDER_REJECTED' as any },
            userId,
          );
          this.menu.end('Order rejected.');
        } catch (error) {
          this.logger.error('Error rejecting order via USSD', error);
          this.menu.end(
            'We could not reject this order. Please try again later.',
          );
        }
      },
    });

    // View pickup details for ORDER_ACCEPTED
    this.menu.state('orders.pickupDetails', {
      run: async () => {
        const orderId = await this.menu.session.get(
          'orders:selectedId',
        );

        if (!orderId) {
          this.menu.go('orders.menu');
          return;
        }

        try {
          const request = await this.prisma.transportRequest.findFirst({
            where: { orderId },
            include: {
              pickupSchedule: {
                include: {
                  aggregationCenter: true,
                },
              },
            },
          });

          if (!request || !request.pickupSchedule) {
            this.menu.con(
              'No pickup details available for this order.' +
                '\n\n98. Back  99. Main',
            );
            return;
          }

          const schedule: any = request.pickupSchedule;
          const centerName = schedule.aggregationCenter?.name || '-';
          const date = new Date(schedule.scheduledDate);
          const dateStr = `${date.getDate()} ${date.toLocaleString('en-US', {
            month: 'short',
          })} ${schedule.scheduledTime}`;

          const lines: string[] = [];
          lines.push(`Pickup Details`);
          lines.push(`Center: ${centerName}`);
          lines.push(`Date: ${dateStr}`);
          lines.push(`Route: ${schedule.route || '-'}`);
          lines.push('');
          lines.push('98. Back  99. Main');

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching pickup details for USSD order', error);
          this.menu.end(
            'Unable to fetch pickup details. Please try again later.',
          );
        }
      },
      next: {
        '98': 'orders.menu',
        '99': 'menu.main',
        '*\\d+': 'orders.menu',
      },
    });

    /**
     * Pickups & Delivery (Option 2)
     * - View pickup schedules by centre and book slots
     * - View and manage farmer pickup bookings
     */
    this.menu.state('pickups.menu', {
      run: () => {
        this.menu.con(
          'Pickups & Delivery' +
            '\n1. View pickup schedules' +
            '\n2. My pickup bookings' +
            '\n98. Back   99. Main',
        );
      },
      next: {
        '1': 'pickups.centers',
        '2': 'pickups.bookings.list',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'pickups.menu',
      },
    });

    // 4.1.1 Select centre (with simple pagination using 6. More)
    this.menu.state('pickups.centers', {
      run: async () => {
        try {
          let centers = (await this.menu.session.get(
            'pickups:centers',
          )) as any[];

          if (!centers) {
            centers = await this.aggregationService.getAggregationCenters({
              status: 'OPERATIONAL',
            });
            await this.menu.session.set('pickups:centers', centers);
            await this.menu.session.set('pickups:centersOffset', 0);
          }

          if (!centers || centers.length === 0) {
            await this.menu.session.set('pickups:centersPageSize', 0);
            this.menu.con(
              'No pickup centres available.' + '\n\n98. Back   99. Main',
            );
            return;
          }

          const pageSize = 5;
          let offset =
            ((await this.menu.session.get(
              'pickups:centersOffset',
            )) as number) ?? 0;
          if (offset < 0 || offset >= centers.length) {
            offset = 0;
          }

          const pageItems = centers.slice(offset, offset + pageSize);

          const lines: string[] = ['Select centre'];
          for (let i = 0; i < pageItems.length; i++) {
            const c = pageItems[i];
            lines.push(`${i + 1}. ${c.name}`);
          }

          const hasMore = offset + pageSize < centers.length;
          if (hasMore) {
            lines.push('6. More');
          }
          lines.push('98. Back   99. Main');

          // Store page info for routing
          await this.menu.session.set('pickups:centersPageSize', pageItems.length);
          await this.menu.session.set('pickups:centersHasMore', hasMore);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching centres for USSD pickups', error);
          this.menu.end(
            'Unable to fetch pickup centres. Please try again later.',
          );
        }
      },
      // Explicit static routing for center selection
      next: {
        '1': 'pickups.schedules',
        '2': 'pickups.schedules',
        '3': 'pickups.schedules',
        '4': 'pickups.schedules',
        '5': 'pickups.schedules',
        '6': 'pickups.centers.more',
        '98': 'pickups.menu',
        '99': 'menu.main',
        '*\\d+': 'pickups.centers',
      },
    });

    // "More" for centres list
    this.menu.state('pickups.centers.more', {
      run: async () => {
        const centers = (await this.menu.session.get(
          'pickups:centers',
        )) as any[];

        if (!centers || centers.length === 0) {
          this.menu.go('pickups.centers');
          return;
        }

        const pageSize = 5;
        let offset =
          ((await this.menu.session.get(
            'pickups:centersOffset',
          )) as number) ?? 0;
        offset += pageSize;
        if (offset >= centers.length) {
          offset = 0;
        }
        await this.menu.session.set('pickups:centersOffset', offset);
        this.menu.go('pickups.centers');
      },
      // Must have explicit routing since this state uses go() to display content
      next: {
        '1': 'pickups.schedules',
        '2': 'pickups.schedules',
        '3': 'pickups.schedules',
        '4': 'pickups.schedules',
        '5': 'pickups.schedules',
        '6': 'pickups.centers.more',
        '98': 'pickups.menu',
        '99': 'menu.main',
        '*\\d+': 'pickups.centers',
      },
    });

    // 4.1.2 List schedules for selected centre (with 6. More pagination)
    this.menu.state('pickups.schedules', {
      run: async () => {
        let center = await this.menu.session.get(
          'pickups:selectedCenter',
        );
        let schedules = (await this.menu.session.get(
          'pickups:schedules',
        )) as any[];

        // First time: interpret user input as centre selection and fetch schedules
        if (!center) {
          const indexStr = String(this.menu.val || '').trim();
          const choice = parseInt(indexStr, 10);

          const centers = (await this.menu.session.get(
            'pickups:centers',
          )) as any[];
          const centersOffset =
            ((await this.menu.session.get(
              'pickups:centersOffset',
            )) as number) ?? 0;

          const pageSize = ((await this.menu.session.get('pickups:centersPageSize')) as number) ?? 5;

          if (
            !centers ||
            Number.isNaN(choice) ||
            choice < 1 ||
            choice > pageSize
          ) {
            await this.menu.session.set('pickups:schedulesError', true);
            this.menu.con('Invalid selection.\n\n98. Back   99. Main');
            return;
          }

          const globalIndex = centersOffset + (choice - 1);
          if (globalIndex < 0 || globalIndex >= centers.length) {
            await this.menu.session.set('pickups:schedulesError', true);
            this.menu.con('Invalid selection.\n\n98. Back   99. Main');
            return;
          }

          center = centers[globalIndex];

          try {
            const today = new Date();
            schedules = await this.transportService.getPickupSchedules({
              centerId: center.id,
              status: 'PUBLISHED',
              dateFrom: today.toISOString(),
            });

            await this.menu.session.set('pickups:schedules', schedules);
            await this.menu.session.set('pickups:selectedCenter', center);
            await this.menu.session.set('pickups:schedulesOffset', 0);
          } catch (error) {
            this.logger.error('Error fetching pickup schedules for USSD', error);
            this.menu.end(
              'Unable to fetch pickup schedules. Please try again later.',
            );
            return;
          }
        }

        await this.menu.session.set('pickups:schedulesError', false);

        if (!schedules || schedules.length === 0) {
          await this.menu.session.set('pickups:schedulesPageSize', 0);
          this.menu.con(
            `${center.name}\nNo upcoming pickup schedules.\n\n98. Back   99. Main`,
          );
          return;
        }

        const pageSize = 5;
        let offset =
          ((await this.menu.session.get(
            'pickups:schedulesOffset',
          )) as number) ?? 0;
        if (offset < 0 || offset >= schedules.length) {
          offset = 0;
        }

        const pageItems = schedules.slice(offset, offset + pageSize);

        const lines: string[] = [center.name];
        for (let i = 0; i < pageItems.length; i++) {
          const s = pageItems[i];
          const date = new Date(s.scheduledDate);
          const dateStr = `${date.getDate()} ${date.toLocaleString('en-US', {
            month: 'short',
          })} ${s.scheduledTime}`;
          lines.push(
            `${i + 1}. ${dateStr} - ${s.availableCapacity ?? 0}kg free`,
          );
        }

        const hasMore = offset + pageSize < schedules.length;
        if (hasMore) {
          lines.push('6. More');
        }
        lines.push('98. Back   99. Main');

        // Store page info for routing
        await this.menu.session.set('pickups:schedulesPageSize', pageItems.length);
        await this.menu.session.set('pickups:schedulesHasMore', hasMore);

        this.menu.con(lines.join('\n'));
      },
      // Explicit static routing for schedule selection
      next: {
        '1': 'pickups.schedule.detail',
        '2': 'pickups.schedule.detail',
        '3': 'pickups.schedule.detail',
        '4': 'pickups.schedule.detail',
        '5': 'pickups.schedule.detail',
        '6': 'pickups.schedules.more',
        '98': 'pickups.centers',
        '99': 'menu.main',
        '*\\d+': 'pickups.schedules',
      },
    });

    // "More" for schedules list
    this.menu.state('pickups.schedules.more', {
      run: async () => {
        const schedules = (await this.menu.session.get(
          'pickups:schedules',
        )) as any[];

        if (!schedules || schedules.length === 0) {
          this.menu.go('pickups.schedules');
          return;
        }

        const pageSize = 5;
        let offset =
          ((await this.menu.session.get(
            'pickups:schedulesOffset',
          )) as number) ?? 0;
        offset += pageSize;
        if (offset >= schedules.length) {
          offset = 0;
        }
        await this.menu.session.set('pickups:schedulesOffset', offset);
        this.menu.go('pickups.schedules');
      },
      // Must have explicit routing since this state uses go() to display content
      next: {
        '1': 'pickups.schedule.detail',
        '2': 'pickups.schedule.detail',
        '3': 'pickups.schedule.detail',
        '4': 'pickups.schedule.detail',
        '5': 'pickups.schedule.detail',
        '6': 'pickups.schedules.more',
        '98': 'pickups.centers',
        '99': 'menu.main',
        '*\\d+': 'pickups.schedules',
      },
    });

    // 4.1.3 Schedule details + book
    this.menu.state('pickups.schedule.detail', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const schedules = (await this.menu.session.get(
          'pickups:schedules',
        )) as any[];
        const center = await this.menu.session.get(
          'pickups:selectedCenter',
        );
        const offset =
          ((await this.menu.session.get(
            'pickups:schedulesOffset',
          )) as number) ?? 0;
        const pageSize = ((await this.menu.session.get('pickups:schedulesPageSize')) as number) ?? 5;

        if (
          !schedules ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > pageSize
        ) {
          await this.menu.session.set('pickups:scheduleDetailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        const globalIndex = offset + (choice - 1);
        if (globalIndex < 0 || globalIndex >= schedules.length) {
          await this.menu.session.set('pickups:scheduleDetailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('pickups:scheduleDetailError', false);
        await this.menu.session.set('pickups:scheduleDetailValid', true);

        const schedule = schedules[globalIndex];
        await this.menu.session.set('pickups:selectedSchedule', schedule);

        const date = new Date(schedule.scheduledDate);
        const dateStr = `${date.getDate()} ${date.toLocaleString('en-US', {
          month: 'short',
        })} ${schedule.scheduledTime}`;

        const lines: string[] = [];
        lines.push(`Schedule ${schedule.scheduleNumber || ''}`.trim());
        lines.push(`Center: ${center?.name || '-'}`);
        lines.push(`Date: ${dateStr}`);
        lines.push(
          `Free: ${schedule.availableCapacity ?? schedule.totalCapacity ?? 0}kg`,
        );
        lines.push('');
        lines.push('1. Book this schedule');
        lines.push('98. Back   99. Main');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const error = await this.menu.session.get('pickups:scheduleDetailError');
            if (error) return 'pickups.schedules';

            if (input === '1') return 'pickups.book.quantity';
            return 'pickups.schedule.detail';
          },
          { back: 'pickups.schedules', main: 'menu.main' },
        ),
      },
    });

    // 4.1.4 Enter quantity
    this.menu.state('pickups.book.quantity', {
      run: async () => {
        const schedule = await this.menu.session.get(
          'pickups:selectedSchedule',
        );

        if (!schedule) {
          this.menu.go('pickups.menu');
          return;
        }

        const available =
          schedule.availableCapacity ?? schedule.totalCapacity ?? 0;

        this.menu.con(
          'Enter quantity in kg' +
            `\nMax: ${available}kg` +
            '\n(e.g. 500)',
        );
      },
      next: {
        '*\\d+': 'pickups.book.confirm',
      },
    });

    // 4.1.5 Confirm booking and create booking
    this.menu.state('pickups.book.confirm', {
      run: async () => {
        const schedule = await this.menu.session.get(
          'pickups:selectedSchedule',
        );
        const center = await this.menu.session.get(
          'pickups:selectedCenter',
        );
        const userId = await this.menu.session.get('userId');
        const rawQty = String(this.menu.val || '').trim();
        const qty = parseInt(rawQty, 10);

        if (!schedule || !userId || Number.isNaN(qty) || qty <= 0) {
          await this.menu.session.set('pickups:bookConfirmState', 'invalid');
          this.menu.con('Invalid quantity.\n\n98. Back   99. Main');
          return;
        }

        const available =
          schedule.availableCapacity ?? schedule.totalCapacity ?? 0;
        if (qty > available) {
          await this.menu.session.set('pickups:bookConfirmState', 'exceeds');
          this.menu.con(
            `Requested quantity exceeds available (${available}kg).` +
              '\n\n98. Back   99. Main',
          );
          return;
        }

        // Save quantity in session
        await this.menu.session.set('pickups:quantity', qty);
        await this.menu.session.set('pickups:bookConfirmState', 'ready');

        const lines: string[] = [];
        lines.push('Confirm booking:');
        lines.push(`Center: ${center?.name || '-'}`);
        const date = new Date(schedule.scheduledDate);
        const dateStr = `${date.getDate()} ${date.toLocaleString('en-US', {
          month: 'short',
        })} ${schedule.scheduledTime}`;
        lines.push(`Date: ${dateStr}`);
        lines.push(`Qty: ${qty}kg`);
        lines.push('');
        lines.push('1. Confirm');
        lines.push('2. Cancel');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const state = await this.menu.session.get('pickups:bookConfirmState');

            if (state === 'invalid') {
              if (input === '98') return 'pickups.schedule.detail';
              return 'pickups.book.quantity';
            }
            if (state === 'exceeds') {
              if (input === '98') return 'pickups.book.quantity';
              return 'pickups.book.quantity';
            }

            // Ready state
            if (input === '1') return 'pickups.book.submit';
            if (input === '2') return 'pickups.menu';
            return 'pickups.book.confirm';
          },
          { back: 'pickups.schedule.detail', main: 'menu.main' },
        ),
      },
    });

    this.menu.state('pickups.book.submit', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const schedule = await this.menu.session.get(
          'pickups:selectedSchedule',
        );
        const qty = await this.menu.session.get(
          'pickups:quantity',
        );
        const userId = await this.menu.session.get('userId');
        const phone = this.menu.args.phoneNumber as string;

        if (!schedule || !userId || !qty) {
          this.menu.go('pickups.menu');
          return;
        }

        try {
          await this.transportService.bookPickupSlot(
            schedule.id,
            {
              quantity: Number(qty),
              location: 'Farmer location',
              contactPhone: phone,
            },
            userId,
          );
          this.menu.end(
            'Pickup booking confirmed. You will receive SMS with details.',
          );
        } catch (error) {
          this.logger.error('Error booking pickup slot via USSD', error);
          this.menu.end(
            'We could not complete your booking. Please try again later.',
          );
        }
      },
    });

    // 4.2 My pickup bookings
    this.menu.state('pickups.bookings.list', {
      run: async () => {
        const userId = await this.menu.session.get('userId');

        if (!userId) {
          this.menu.goStart();
          return;
        }

        try {
          const bookings =
            await this.transportService.getFarmerPickupBookings(userId, {});

          if (!bookings || bookings.length === 0) {
            await this.menu.session.set('pickups:bookingsPageSize', 0);
            this.menu.con(
              'You have no pickup bookings.' + '\n\n98. Back   99. Main',
            );
            return;
          }

          await this.menu.session.set('pickups:bookings', bookings);
          await this.menu.session.set('pickups:bookingsOffset', 0);

          const pageSize = 5;
          const offset = 0;
          const pageItems = bookings.slice(offset, offset + pageSize);

          const lines: string[] = ['My Bookings'];
          for (let i = 0; i < pageItems.length; i++) {
            const b = pageItems[i];
            const schedule = b.slot?.schedule;
            const date = schedule ? new Date(schedule.scheduledDate) : null;
            const dateStr = date
              ? `${date.getDate()} ${date.toLocaleString('en-US', {
                  month: 'short',
                })}`
              : '-';
            const center = schedule?.aggregationCenter?.name || '-';
            lines.push(
              `${i + 1}. ${dateStr} - ${center} - ${b.quantity}kg - ${b.status}`,
            );
          }
          const hasMore = bookings.length > pageSize;
          if (hasMore) {
            lines.push('6. More');
          }
          lines.push('98. Back   99. Main');

          // Store page info for routing
          await this.menu.session.set('pickups:bookingsPageSize', pageItems.length);
          await this.menu.session.set('pickups:bookingsHasMore', hasMore);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching pickup bookings via USSD', error);
          this.menu.end(
            'Unable to fetch your bookings. Please try again later.',
          );
        }
      },
      // Explicit static routing for booking selection
      next: {
        '1': 'pickups.bookings.detail',
        '2': 'pickups.bookings.detail',
        '3': 'pickups.bookings.detail',
        '4': 'pickups.bookings.detail',
        '5': 'pickups.bookings.detail',
        '6': 'pickups.bookings.more',
        '98': 'pickups.menu',
        '99': 'menu.main',
        '*\\d+': 'pickups.bookings.list',
      },
    });

    // "More" for bookings list
    this.menu.state('pickups.bookings.more', {
      run: async () => {
        const bookings = (await this.menu.session.get(
          'pickups:bookings',
        )) as any[];

        if (!bookings || bookings.length === 0) {
          this.menu.go('pickups.bookings.list');
          return;
        }

        const pageSize = 5;
        let offset =
          ((await this.menu.session.get(
            'pickups:bookingsOffset',
          )) as number) ?? 0;
        offset += pageSize;
        if (offset >= bookings.length) {
          offset = 0;
        }
        await this.menu.session.set('pickups:bookingsOffset', offset);

        // Re-render list from new offset
        const pageItems = bookings.slice(offset, offset + pageSize);
        const lines: string[] = ['My Bookings'];
        for (let i = 0; i < pageItems.length; i++) {
          const b = pageItems[i];
          const schedule = b.slot?.schedule;
          const date = schedule ? new Date(schedule.scheduledDate) : null;
          const dateStr = date
            ? `${date.getDate()} ${date.toLocaleString('en-US', {
                month: 'short',
              })}`
            : '-';
          const center = schedule?.aggregationCenter?.name || '-';
          lines.push(
            `${i + 1}. ${dateStr} - ${center} - ${b.quantity}kg - ${b.status}`,
          );
        }
        const hasMore = offset + pageSize < bookings.length;
        if (hasMore) {
          lines.push('6. More');
        }
        lines.push('98. Back   99. Main');

        // Update page info for routing
        await this.menu.session.set('pickups:bookingsPageSize', pageItems.length);
        await this.menu.session.set('pickups:bookingsHasMore', hasMore);

        this.menu.con(lines.join('\n'));
      },
      // Explicit static routing for booking selection (from "more" page)
      next: {
        '1': 'pickups.bookings.detail',
        '2': 'pickups.bookings.detail',
        '3': 'pickups.bookings.detail',
        '4': 'pickups.bookings.detail',
        '5': 'pickups.bookings.detail',
        '6': 'pickups.bookings.more',
        '98': 'pickups.menu',
        '99': 'menu.main',
        '*\\d+': 'pickups.bookings.list',
      },
    });

    this.menu.state('pickups.bookings.detail', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const bookings = (await this.menu.session.get(
          'pickups:bookings',
        )) as any[];
        const offset =
          ((await this.menu.session.get(
            'pickups:bookingsOffset',
          )) as number) ?? 0;
        const pageSize = ((await this.menu.session.get('pickups:bookingsPageSize')) as number) ?? 5;

        if (
          !bookings ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > pageSize
        ) {
          await this.menu.session.set('pickups:bookingDetailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        const globalIndex = offset + (choice - 1);
        if (globalIndex < 0 || globalIndex >= bookings.length) {
          await this.menu.session.set('pickups:bookingDetailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('pickups:bookingDetailError', false);

        const booking = bookings[globalIndex];
        await this.menu.session.set('pickups:selectedBooking', booking);

        const schedule = booking.slot?.schedule;
        const center = schedule?.aggregationCenter?.name || '-';
        const date = schedule ? new Date(schedule.scheduledDate) : null;
        const dateStr = date
          ? `${date.getDate()} ${date.toLocaleString('en-US', {
              month: 'short',
            })} ${schedule.scheduledTime}`
          : '-';

        const lines: string[] = [];
        lines.push(`Booking ${booking.id}`);
        lines.push(`Sch: ${dateStr}`);
        lines.push(`Center: ${center}`);
        lines.push(`Qty: ${booking.quantity}kg`);
        lines.push(`Status: ${booking.status}`);
        lines.push('');

        // Store available actions for routing
        const canCancel = booking.status !== 'cancelled' && booking.status !== 'completed';
        const canConfirm = !booking.pickupConfirmed && booking.status !== 'cancelled';
        await this.menu.session.set('pickups:bookingCanCancel', canCancel);
        await this.menu.session.set('pickups:bookingCanConfirm', canConfirm);

        if (canCancel) {
          lines.push('1. Cancel booking');
        }
        if (canConfirm) {
          lines.push('2. Confirm pickup');
        }

        lines.push('98. Back   99. Main');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const error = await this.menu.session.get('pickups:bookingDetailError');
            if (error) return 'pickups.bookings.list';

            const canCancel = await this.menu.session.get('pickups:bookingCanCancel');
            const canConfirm = await this.menu.session.get('pickups:bookingCanConfirm');

            if (input === '1' && canCancel) return 'pickups.bookings.cancel';
            if (input === '2' && canConfirm) return 'pickups.bookings.confirm';
            return 'pickups.bookings.detail';
          },
          { back: 'pickups.bookings.list', main: 'menu.main' },
        ),
      },
    });

    this.menu.state('pickups.bookings.cancel', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const booking = await this.menu.session.get(
          'pickups:selectedBooking',
        );
        const userId = await this.menu.session.get('userId');

        if (!booking || !userId) {
          this.menu.go('pickups.bookings.list');
          return;
        }

        try {
          await this.transportService.cancelPickupSlotBooking(
            booking.id,
            userId,
          );
          this.menu.end('Booking cancelled successfully.');
        } catch (error) {
          this.logger.error('Error cancelling pickup booking via USSD', error);
          this.menu.end(
            'We could not cancel this booking. Please try again later.',
          );
        }
      },
    });

    this.menu.state('pickups.bookings.confirm', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const booking = await this.menu.session.get(
          'pickups:selectedBooking',
        );
        const userId = await this.menu.session.get('userId');

        if (!booking || !userId) {
          this.menu.go('pickups.bookings.list');
          return;
        }

        try {
          await this.transportService.confirmPickup(
            booking.id,
            {
              variety: booking.variety || 'Kabonde',
              qualityGrade: (booking.qualityGrade as any) || 'A',
            } as any,
            userId,
          );
          this.menu.end('Pickup confirmed. Thank you.');
        } catch (error) {
          this.logger.error('Error confirming pickup via USSD', error);
          this.menu.end(
            'We could not confirm this pickup. Please try again later.',
          );
        }
      },
    });

    /**
     * Market Info & Prices (Option 3)
     */
    this.menu.state('market.menu', {
      run: async () => {
        try {
          const info = await this.analyticsService.getMarketInfo({
            location: undefined,
            variety: undefined,
            timeRange: undefined,
            dateRange: undefined,
          } as any);

          const prices = Array.isArray(info?.prices)
            ? info.prices.slice(0, 5)
            : [];

          if (!prices.length) {
            this.menu.con(
              'Today’s Prices (KES/kg)\nNo price data.\n\n98. Back   99. Main',
            );
            return;
          }

          const lines: string[] = ['Today’s Prices (KES/kg)'];
          prices.forEach((p: any, idx: number) => {
            lines.push(
              `${idx + 1}. ${p.variety || p.label || 'Variety'}: ${
                p.pricePerKg || p.price || 0
              }`,
            );
          });
          lines.push('98. Back   99. Main');

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching market info for USSD', error);
          this.menu.end(
            'Unable to fetch market prices. Please try again later.',
          );
        }
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => 'menu.main',
          { back: 'menu.main', main: 'menu.main' },
        ),
      },
    });

    /**
     * Buyer Requests (Option 4) – Sourcing Requests + batch-linked supplier offers
     */
    this.menu.state('rfq.menu', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const userId = await this.menu.session.get('userId');

        if (!userId) {
          this.menu.goStart();
          return;
        }

        try {
          const requests = await this.marketplaceService.getSourcingRequests({
            status: 'OPEN',
          });

          if (!requests || requests.length === 0) {
            this.menu.con(
              'Top Buyer Requests\nNone available.\n\n98. Back   99. Main',
            );
            await this.menu.session.set('rfq:listSize', 0);
            return;
          }

          await this.menu.session.set('rfq:list', requests);

          const lines: string[] = ['Top Buyer Requests'];
          const max = Math.min(5, requests.length);
          for (let i = 0; i < max; i++) {
            const r = requests[i];
            lines.push(
              `${i + 1}. ${r.quantity}${r.unit || 'kg'} ${
                r.variety
              } – ${r.deliveryRegion || ''} (${r.requestId})`,
            );
          }
          lines.push('98. Back   99. Main');

          // Store list size for routing
          await this.menu.session.set('rfq:listSize', max);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching sourcing requests for USSD', error);
          this.menu.end(
            'Unable to fetch buyer requests. Please try again later.',
          );
        }
      },
      // Explicit static routing for RFQ selection
      next: {
        '1': 'rfq.detail',
        '2': 'rfq.detail',
        '3': 'rfq.detail',
        '4': 'rfq.detail',
        '5': 'rfq.detail',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'rfq.menu',
      },
    });

    this.menu.state('rfq.detail', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const requests = (await this.menu.session.get(
          'rfq:list',
        )) as any[];
        const listSize = ((await this.menu.session.get('rfq:listSize')) as number) ?? 5;

        if (
          !requests ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > listSize
        ) {
          await this.menu.session.set('rfq:detailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('rfq:detailError', false);

        const request = requests[choice - 1];
        await this.menu.session.set('rfq:selected', request);

        const buyerProfile = request.buyer?.profile;
        const buyerName = buyerProfile
          ? `${buyerProfile.firstName} ${buyerProfile.lastName}`
          : request.buyer?.email || request.buyer?.phone || '';

        const lines: string[] = [];
        lines.push(`Request ${request.requestId}`);
        lines.push(`Buyer: ${buyerName}`);
        lines.push(`Variety: ${request.variety}`);
        lines.push(`Qty: ${request.quantity}${request.unit || 'kg'}`);
        if (request.pricePerUnit) {
          lines.push(
            `Target: ${request.pricePerUnit}/${request.priceUnit || 'kg'}`,
          );
        }
        lines.push('');
        lines.push('1. Submit offer');
        lines.push('98. Back   99. Main');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const error = await this.menu.session.get('rfq:detailError');
            if (error) return 'rfq.menu';

            if (input === '1') return 'rfq.batches';
            return 'rfq.detail';
          },
          { back: 'rfq.menu', main: 'menu.main' },
        ),
      },
    });

    // 6.3.1 Select batch from inventory
    this.menu.state('rfq.batches', {
      run: async () => {
        const userId = await this.menu.session.get('userId');

        if (!userId) {
          this.menu.goStart();
          return;
        }

        try {
          const inventory = await this.aggregationService.getInventory(
            undefined,
            userId,
          );

          if (!inventory || inventory.length === 0) {
            await this.menu.session.set('rfq:inventorySize', 0);
            this.menu.con(
              'No inventory batches available.\n\n98. Back   99. Main',
            );
            return;
          }

          await this.menu.session.set('rfq:inventory', inventory);

          const lines: string[] = ['Select batch to offer'];
          const max = Math.min(5, inventory.length);
          for (let i = 0; i < max; i++) {
            const b = inventory[i];
            lines.push(
              `${i + 1}. ${b.batchId} – ${b.variety} – ${b.quantity}kg`,
            );
          }
          lines.push('98. Back   99. Main');

          // Store size for routing
          await this.menu.session.set('rfq:inventorySize', max);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching inventory for RFQ USSD flow', error);
          this.menu.end(
            'Unable to fetch your inventory. Please try again later.',
          );
        }
      },
      // Explicit static routing for batch selection
      next: {
        '1': 'rfq.price',
        '2': 'rfq.price',
        '3': 'rfq.price',
        '4': 'rfq.price',
        '5': 'rfq.price',
        '98': 'rfq.detail',
        '99': 'menu.main',
        '*\\d+': 'rfq.batches',
      },
    });

    // 6.3.2 Enter price
    this.menu.state('rfq.price', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const inventory = (await this.menu.session.get(
          'rfq:inventory',
        )) as any[];
        const inventorySize = ((await this.menu.session.get('rfq:inventorySize')) as number) ?? 5;

        if (
          !inventory ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > inventorySize
        ) {
          await this.menu.session.set('rfq:priceError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('rfq:priceError', false);
        await this.menu.session.set('rfq:priceReady', true);

        const batch = inventory[choice - 1];
        await this.menu.session.set('rfq:selectedBatch', batch);

        this.menu.con(
          'Enter your price per kg' + '\n(e.g. 41)',
        );
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const error = await this.menu.session.get('rfq:priceError');
            if (error) return 'rfq.batches';
            return 'rfq.quantity';
          },
          { back: 'rfq.batches', main: 'menu.main' },
        ),
      },
    });

    // 6.3.3 Enter quantity
    this.menu.state('rfq.quantity', {
      run: async () => {
        const rawPrice = String(this.menu.val || '').trim();
        const price = parseInt(rawPrice, 10);

        if (Number.isNaN(price) || price <= 0) {
          await this.menu.session.set('rfq:quantityError', true);
          this.menu.con('Invalid price.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('rfq:quantityError', false);
        await this.menu.session.set('rfq:price', price);

        const batch = await this.menu.session.get(
          'rfq:selectedBatch',
        );
        const maxQty = batch?.quantity || 0;

        this.menu.con(
          `Enter quantity in kg\nMax: ${maxQty}kg` + '\n(e.g. 600)',
        );
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const error = await this.menu.session.get('rfq:quantityError');
            if (error) return 'rfq.price';
            return 'rfq.confirm';
          },
          { back: 'rfq.batches', main: 'menu.main' },
        ),
      },
    });

    // 6.3.4 Confirm and submit supplier offer for sourcing request
    this.menu.state('rfq.confirm', {
      run: async () => {
        const rawQty = String(this.menu.val || '').trim();
        const qty = parseInt(rawQty, 10);

        const price = await this.menu.session.get('rfq:price');
        const batch = await this.menu.session.get(
          'rfq:selectedBatch',
        );
        const request = await this.menu.session.get('rfq:selected');
        const userId = await this.menu.session.get('userId');

        if (!request || !batch || !userId || Number.isNaN(qty) || qty <= 0) {
          this.menu.go('rfq.menu');
          return;
        }

        if (qty > (batch.quantity || 0)) {
          await this.menu.session.set('rfq:confirmState', 'exceeds');
          this.menu.con(
            `Quantity exceeds batch quantity (${batch.quantity}kg).` +
              '\n\n98. Back   99. Main',
          );
          return;
        }

        await this.menu.session.set('rfq:confirmState', 'ready');
        await this.menu.session.set('rfq:quantity', qty);

        const lines: string[] = [];
        lines.push('Confirm offer:');
        lines.push(`Batch: ${batch.batchId}`);
        lines.push(`Price: ${price}/kg`);
        lines.push(`Qty: ${qty}kg`);
        lines.push('');
        lines.push('1. Send');
        lines.push('2. Cancel');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const state = await this.menu.session.get('rfq:confirmState');

            if (state === 'exceeds') return 'rfq.quantity';

            if (input === '1') return 'rfq.submit';
            if (input === '2') return 'rfq.menu';
            return 'rfq.confirm';
          },
          { back: 'rfq.menu', main: 'menu.main' },
        ),
      },
    });

    this.menu.state('rfq.submit', {
      run: async () => {
        const sessionId = this.menu.args.sessionId as string;
        const price = await this.menu.session.get('rfq:price');
        const batch = await this.menu.session.get(
          'rfq:selectedBatch',
        );
        const request = await this.menu.session.get('rfq:selected');
        const userId = await this.menu.session.get('userId');

        if (!request || !batch || !userId || !price) {
          this.menu.go('rfq.menu');
          return;
        }

        try {
          const qty = await this.menu.session.get('rfq:quantity');
          await this.marketplaceService.submitSupplierOffer(
            {
              sourcingRequestId: request.id,
              quantity: Number(qty),
              quantityUnit: 'kg',
              pricePerKg: Number(price),
              batchId: batch.batchId,
            } as any,
            userId,
          );
          this.menu.end('Your offer has been submitted.');
        } catch (error) {
          this.logger.error('Error submitting RFQ response via USSD', error);
          this.menu.end(
            'We could not submit your offer. Please try again later.',
          );
        }
      },
    });

    /**
     * Advisories (Option 5)
     */
    this.menu.state('advisories.menu', {
      run: async () => {
        try {
          const advisories = await this.prisma.advisory.findMany({
            where: {
              isActive: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

          if (!advisories || advisories.length === 0) {
            await this.menu.session.set('advisories:listSize', 0);
            this.menu.con(
              'Latest Advisories\nNone available.\n\n98. Back   99. Main',
            );
            return;
          }

          await this.menu.session.set('advisories:list', advisories);
          await this.menu.session.set('advisories:listSize', advisories.length);

          const lines: string[] = ['Latest Advisories'];
          advisories.forEach((a, idx) => {
            lines.push(`${idx + 1}. ${a.title}`);
          });
          lines.push('98. Back   99. Main');

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching advisories via USSD', error);
          this.menu.end(
            'Unable to fetch advisories. Please try again later.',
          );
        }
      },
      // Explicit static routing for advisory selection
      next: {
        '1': 'advisories.detail',
        '2': 'advisories.detail',
        '3': 'advisories.detail',
        '4': 'advisories.detail',
        '5': 'advisories.detail',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'advisories.menu',
      },
    });

    this.menu.state('advisories.detail', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const advisories = (await this.menu.session.get(
          'advisories:list',
        )) as any[];
        const listSize = ((await this.menu.session.get('advisories:listSize')) as number) ?? 5;

        if (
          !advisories ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > listSize
        ) {
          await this.menu.session.set('advisories:detailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('advisories:detailError', false);

        const advisory = advisories[choice - 1];
        const text = advisory.content || advisory.summary || advisory.title;
        const snippet =
          typeof text === 'string' && text.length > 140
            ? `${text.slice(0, 137)}...`
            : text;

        this.menu.con(
          `${advisory.title}:\n${snippet}\n\n98. Back   99. Main`,
        );
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => 'advisories.menu',
          { back: 'advisories.menu', main: 'menu.main' },
        ),
      },
    });

    /**
     * My Stock / Inventory (Option 6)
     */
    this.menu.state('inventory.menu', {
      run: async () => {
        const userId = await this.menu.session.get('userId');

        if (!userId) {
          this.menu.goStart();
          return;
        }

        try {
          const inventory = await this.aggregationService.getInventory(
            undefined,
            userId,
          );

          if (!inventory || inventory.length === 0) {
            await this.menu.session.set('inventory:listSize', 0);
            this.menu.con(
              'My Stock / Inventory\nNo inventory batches.\n\n98. Back   99. Main',
            );
            return;
          }

          await this.menu.session.set('inventory:list', inventory);

          const lines: string[] = ['My Stock / Inventory'];
          const max = Math.min(5, inventory.length);
          for (let i = 0; i < max; i++) {
            const b = inventory[i];
            lines.push(
              `${i + 1}. ${b.batchId} – ${b.variety} – ${b.quantity}kg – ${b.status}`,
            );
          }
          lines.push('98. Back   99. Main');

          // Store size for routing
          await this.menu.session.set('inventory:listSize', max);

          this.menu.con(lines.join('\n'));
        } catch (error) {
          this.logger.error('Error fetching inventory via USSD', error);
          this.menu.end(
            'Unable to fetch your inventory. Please try again later.',
          );
        }
      },
      // Explicit static routing for inventory item selection
      next: {
        '1': 'inventory.detail',
        '2': 'inventory.detail',
        '3': 'inventory.detail',
        '4': 'inventory.detail',
        '5': 'inventory.detail',
        '98': 'menu.main',
        '99': 'menu.main',
        '*\\d+': 'inventory.menu',
      },
    });

    this.menu.state('inventory.detail', {
      run: async () => {
        const indexStr = String(this.menu.val || '').trim();
        const choice = parseInt(indexStr, 10);

        const inventory = (await this.menu.session.get(
          'inventory:list',
        )) as any[];
        const listSize = ((await this.menu.session.get('inventory:listSize')) as number) ?? 5;

        if (
          !inventory ||
          Number.isNaN(choice) ||
          choice < 1 ||
          choice > listSize
        ) {
          await this.menu.session.set('inventory:detailError', true);
          this.menu.con('Invalid selection.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('inventory:detailError', false);

        const batch = inventory[choice - 1];
        await this.menu.session.set('inventory:selected', batch);

        // Find any existing listing for this batch to get current price
        let listing: any = null;
        try {
          listing = await this.prisma.produceListing.findFirst({
            where: {
              batchId: batch.batchId,
              farmerId: batch.farmerId,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to fetch listing for batch ${batch.batchId} in USSD inventory.detail`,
            error,
          );
        }

        const lines: string[] = [];
        lines.push(`Batch: ${batch.batchId}`);
        lines.push(`Variety: ${batch.variety}`);
        lines.push(`Grade: ${batch.qualityGrade}`);
        lines.push(`Qty: ${batch.quantity}kg`);
        lines.push(`Status: ${batch.status}`);
        lines.push(
          `Current price: ${listing?.pricePerKg ? `${listing.pricePerKg}/kg` : '-'}`,
        );
        lines.push('');
        lines.push('1. Set / update price');
        lines.push('98. Back   99. Main');

        this.menu.con(lines.join('\n'));
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const input = String(this.menu.val || '').trim();
            const error = await this.menu.session.get('inventory:detailError');
            if (error) return 'inventory.menu';

            if (input === '1') return 'inventory.price';
            return 'inventory.detail';
          },
          { back: 'inventory.menu', main: 'menu.main' },
        ),
      },
    });

    this.menu.state('inventory.price', {
      run: async () => {
        const batch = await this.menu.session.get(
          'inventory:selected',
        );

        if (!batch) {
          this.menu.go('inventory.menu');
          return;
        }

        this.menu.con(
          `Set price for ${batch.batchId}\nEnter new price per kg:\n(e.g. 42)`,
        );
      },
      next: {
        '*\\d+': 'inventory.price.confirm',
      },
    });

    this.menu.state('inventory.price.confirm', {
      run: async () => {
        const rawPrice = String(this.menu.val || '').trim();
        const price = parseInt(rawPrice, 10);

        const batch = await this.menu.session.get(
          'inventory:selected',
        );
        const userId = await this.menu.session.get('userId');

        if (!batch || !userId || Number.isNaN(price) || price <= 0) {
          await this.menu.session.set('inventory:priceError', true);
          this.menu.con('Invalid price.\n\n98. Back   99. Main');
          return;
        }

        await this.menu.session.set('inventory:priceError', false);

        // Look for existing listing
        let listing: any = null;
        try {
          listing = await this.prisma.produceListing.findFirst({
            where: {
              batchId: batch.batchId,
              farmerId: batch.farmerId,
            },
          });
        } catch (error) {
          this.logger.warn(
            `Failed to find listing for batch ${batch.batchId} when setting price via USSD`,
            error,
          );
        }

        if (!listing) {
          // If there is no listing yet, we only allow update after listing exists
          this.menu.end(
            'No marketplace listing exists for this batch yet. Please coordinate with aggregation center to list it first.',
          );
          return;
        }

        try {
          await this.marketplaceService.updateListing(
            listing.id,
            { pricePerKg: price } as any,
            userId,
          );
          this.menu.end('Price updated successfully.');
        } catch (error) {
          this.logger.error('Error updating listing price via USSD', error);
          this.menu.end(
            'We could not update the price. Please try again later.',
          );
        }
      },
      next: {
        '*\\d+': this.withStandardNav(
          async () => {
            const error = await this.menu.session.get('inventory:priceError');
            if (error) return 'inventory.price';
            return 'inventory.menu';
          },
          { back: 'inventory.menu', main: 'menu.main' },
        ),
      },
    });
  }
}

