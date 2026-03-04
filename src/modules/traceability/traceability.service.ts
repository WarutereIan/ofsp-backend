import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Normalize QR or batch ID to batchId for lookup */
export function normalizeBatchIdentifier(identifier: string): string {
  const trimmed = (identifier || '').trim();
  if (!trimmed) return trimmed;
  if (trimmed.toUpperCase().startsWith('QR-')) {
    return trimmed.slice(3).trim();
  }
  return trimmed;
}

export interface TraceabilityStepDto {
  id: string;
  stage: string;
  location: string;
  timestamp: string;
  actor: string;
  actorRole?: string;
  status: 'completed' | 'pending' | 'current';
  notes?: string;
  photos?: string[];
  metadata?: {
    temperature?: string;
    humidity?: string;
    qualityGrade?: string;
    quantity?: number;
    duration?: string;
  };
}

export interface BatchTraceabilityResponseDto {
  batchId: string;
  qrCode?: string;
  variety: string;
  quantity: number;
  qualityGrade: 'A' | 'B' | 'C';
  farmerId: string;
  farmerName: string;
  farmerLocation: string;
  farmerPhone?: string;
  aggregationCenter: string;
  aggregationCenterType?: 'main' | 'satellite';
  receiptId?: string;
  steps: TraceabilityStepDto[];
  currentStatus: string;
  currentLocation?: string;
}

@Injectable()
export class TraceabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getBatchTraceability(identifier: string): Promise<BatchTraceabilityResponseDto | null> {
    const batchId = normalizeBatchIdentifier(identifier);
    if (!batchId) return null;

    const [
      stockTransactions,
      qualityChecks,
      inventoryItem,
      produceListing,
      pickupBooking,
      pickupReceipt,
      orders,
      wastageEntries,
    ] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where: { batchId },
        include: {
          center: true,
          farmer: { include: { profile: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.qualityCheck.findMany({
        where: { batchId },
        include: { checker: { include: { profile: true } }, center: true },
        orderBy: { checkedAt: 'asc' },
      }),
      this.prisma.inventoryItem.findFirst({
        where: { batchId },
        include: { center: true },
      }),
      this.prisma.produceListing.findFirst({
        where: { batchId },
        include: { farmer: { include: { profile: true } } },
      }),
      this.prisma.pickupSlotBooking.findFirst({
        where: { batchId },
        include: { farmer: { include: { profile: true } } },
      }),
      this.prisma.pickupReceipt.findFirst({
        where: { batchId },
        include: { aggregationCenter: true },
      }),
      this.prisma.marketplaceOrder.findMany({
        where: { batchId },
        include: { buyer: { include: { profile: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.wastageEntry.findMany({
        where: { batchId },
        include: { center: true },
        orderBy: { recordedAt: 'asc' },
      }),
    ]);

    if (
      stockTransactions.length === 0 &&
      !inventoryItem &&
      !produceListing &&
      !pickupBooking &&
      !pickupReceipt &&
      orders.length === 0
    ) {
      return null;
    }

    const steps: TraceabilityStepDto[] = [];
    let variety = 'N/A';
    let quantity = 0;
    let qualityGrade: 'A' | 'B' | 'C' = 'B';
    let farmerId = '';
    let farmerName = 'Unknown';
    let farmerLocation = '';
    let farmerPhone: string | undefined;
    let aggregationCenter = 'N/A';
    let aggregationCenterType: 'main' | 'satellite' | undefined;
    let receiptId: string | undefined;
    let qrCode: string | undefined;
    let currentStatus = 'Unknown';
    let currentLocation: string | undefined;

    const centerName = (c: { name?: string } | null) => c?.name || 'Aggregation Center';
    const personName = (u: unknown): string => {
      if (!u || typeof u !== 'object') return 'Unknown';
      const o = u as { profile?: { firstName?: string; lastName?: string } | null; email?: string | null };
      const nameFromProfile = o.profile
        ? [o.profile.firstName, o.profile.lastName].filter(Boolean).join(' ').trim()
        : '';
      return nameFromProfile || (o.email ?? 'Unknown');
    };

    for (const st of stockTransactions) {
      if (!variety || variety === 'N/A') variety = st.variety;
      if (quantity === 0) quantity = st.quantity;
      if (!qualityGrade || qualityGrade === 'B') qualityGrade = (st.qualityGrade as 'A' | 'B' | 'C') || 'B';
      if (!farmerId && st.farmerId) {
        farmerId = st.farmerId;
        farmerName = st.farmerName || personName(st.farmer) || 'Unknown';
        if (st.farmer?.profile) {
          farmerLocation =
            [st.farmer.profile.county, st.farmer.profile.subCounty, st.farmer.profile.ward]
              .filter(Boolean)
              .join(', ') || farmerLocation;
        }
        if (st.farmer && 'phone' in st.farmer) farmerPhone = (st.farmer as { phone: string }).phone;
      }
      if (aggregationCenter === 'N/A' && st.centerName) aggregationCenter = st.centerName;
      if (st.center) {
        aggregationCenter = centerName(st.center);
        aggregationCenterType = (st.center as { centerType?: string }).centerType === 'SATELLITE' ? 'satellite' : 'main';
      }
      if (st.qrCode) qrCode = st.qrCode;

      const status = st.status === 'CONFIRMED' ? 'completed' : st.status === 'PENDING_CONFIRMATION' ? 'pending' : 'completed';
      steps.push({
        id: `st-${st.id}`,
        stage: st.type === 'STOCK_IN' ? 'Stock In - Aggregation Center' : 'Stock Out - Dispatch',
        location: centerName(st.center) || st.centerName || 'Aggregation Center',
        timestamp: st.createdAt.toISOString(),
        actor: st.farmerName || personName(st.farmer) || 'Staff',
        actorRole: st.type === 'STOCK_IN' ? 'Aggregation' : 'Dispatch',
        status,
        notes: st.notes || undefined,
        photos: st.photos?.length ? st.photos : undefined,
        metadata: {
          quantity: st.quantity,
          qualityGrade: st.qualityGrade as 'A' | 'B' | 'C',
        },
      });
    }

    for (const qc of qualityChecks) {
      steps.push({
        id: `qc-${qc.id}`,
        stage: 'Quality Inspection',
        location: centerName(qc.center) || 'Aggregation Center',
        timestamp: qc.checkedAt.toISOString(),
        actor: personName(qc.checker) || 'Quality Officer',
        actorRole: 'Quality Officer',
        status: qc.approved ? 'completed' : 'completed',
        notes: qc.notes || undefined,
        photos: qc.photos?.length ? qc.photos : undefined,
        metadata: {
          qualityGrade: qc.qualityGrade as 'A' | 'B' | 'C',
          quantity: qc.quantity,
        },
      });
    }

    if (inventoryItem) {
      if (!variety || variety === 'N/A') variety = inventoryItem.variety;
      if (quantity === 0) quantity = inventoryItem.quantity;
      if (!qualityGrade) qualityGrade = inventoryItem.qualityGrade as 'A' | 'B' | 'C';
      if (!farmerName || farmerName === 'Unknown') farmerName = inventoryItem.farmerName || 'Unknown';
      if (!aggregationCenter) aggregationCenter = centerName(inventoryItem.center);
      currentStatus = inventoryItem.status || 'In Storage';
      currentLocation = centerName(inventoryItem.center);
      steps.push({
        id: `inv-${inventoryItem.id}`,
        stage: 'Storage Entry',
        location: centerName(inventoryItem.center),
        timestamp: inventoryItem.stockInDate.toISOString(),
        actor: 'Storage',
        actorRole: 'Storage',
        status: 'completed',
        metadata: {
          quantity: inventoryItem.quantity,
          qualityGrade: inventoryItem.qualityGrade as 'A' | 'B' | 'C',
          temperature: inventoryItem.temperature != null ? `${inventoryItem.temperature}°C` : undefined,
          humidity: inventoryItem.humidity != null ? `${inventoryItem.humidity}%` : undefined,
        },
      });
    }

    if (pickupBooking) {
      if (!variety || variety === 'N/A') variety = pickupBooking.variety || variety;
      if (!qualityGrade && pickupBooking.qualityGrade) qualityGrade = pickupBooking.qualityGrade as 'A' | 'B' | 'C';
      if (!farmerId) farmerId = pickupBooking.farmerId;
      if (farmerName === 'Unknown') farmerName = personName(pickupBooking.farmer) || 'Farmer';
      if (pickupBooking.qrCode) qrCode = pickupBooking.qrCode;
      steps.push({
        id: `pickup-${pickupBooking.id}`,
        stage: 'Pickup Confirmed',
        location: 'Pickup / Collection Point',
        timestamp: (pickupBooking.pickupConfirmedAt || pickupBooking.bookedAt).toISOString(),
        actor: personName(pickupBooking.farmer) || 'Farmer',
        actorRole: 'Farmer',
        status: 'completed',
        notes: `Batch ${batchId} created at pickup. Quantity: ${pickupBooking.photos?.length ? 'documented' : 'confirmed'}.`,
        photos: pickupBooking.photos?.length ? pickupBooking.photos : undefined,
        metadata: { qualityGrade: pickupBooking.qualityGrade as 'A' | 'B' | 'C' },
      });
    }

    if (pickupReceipt) {
      receiptId = pickupReceipt.receiptNumber;
      if (aggregationCenter === 'N/A') aggregationCenter = centerName(pickupReceipt.aggregationCenter);
      if (!qrCode) qrCode = pickupReceipt.qrCode;
    }

    if (produceListing) {
      if (!variety || variety === 'N/A') variety = produceListing.variety;
      if (quantity === 0 && produceListing.quantity) quantity = produceListing.quantity;
      if (!qualityGrade && produceListing.qualityGrade) qualityGrade = produceListing.qualityGrade as 'A' | 'B' | 'C';
      if (!farmerId) farmerId = produceListing.farmerId;
      if (farmerName === 'Unknown') farmerName = personName(produceListing.farmer) || 'Farmer';
      if (produceListing.qrCode) qrCode = produceListing.qrCode;
    }

    for (const we of wastageEntries) {
      steps.push({
        id: `waste-${we.id}`,
        stage: 'Wastage Recorded',
        location: centerName(we.center) || 'Aggregation Center',
        timestamp: we.recordedAt.toISOString(),
        actor: we.recordedByName || 'Staff',
        actorRole: 'Aggregation',
        status: 'completed',
        notes: we.reason || undefined,
        metadata: { quantity: we.quantity },
      });
    }

    for (const order of orders) {
      steps.push({
        id: `order-${order.id}`,
        stage: 'Order / Sale',
        location: aggregationCenter || 'N/A',
        timestamp: order.createdAt.toISOString(),
        actor: personName(order.buyer) || 'Buyer',
        actorRole: 'Buyer',
        status: 'completed',
        notes: `Order linked to batch ${batchId}.`,
        metadata: {},
      });
    }

    steps.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (steps.length > 0) {
      steps[steps.length - 1].status = 'current';
      currentStatus = steps[steps.length - 1].stage;
      currentLocation = steps[steps.length - 1].location;
    }

    return {
      batchId,
      qrCode: qrCode || `QR-${batchId}`,
      variety,
      quantity,
      qualityGrade,
      farmerId,
      farmerName,
      farmerLocation: farmerLocation || 'N/A',
      farmerPhone,
      aggregationCenter,
      aggregationCenterType,
      receiptId,
      steps,
      currentStatus,
      currentLocation,
    };
  }
}
