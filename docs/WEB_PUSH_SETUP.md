# Web Push Notifications Setup Guide

This guide explains how to set up and use web push notifications in the OFSP platform.

## Overview

The notification system now supports multiple channels:
- **web-push** (default) - Browser push notifications using Web Push API
- **email** - Email notifications (TODO)
- **sms** - SMS notifications (TODO)
- **in-app** - In-app notifications (database records)

All notifications are sent through the `web-push` channel by default unless otherwise specified.

## Prerequisites

1. **Generate VAPID Keys**

   VAPID (Voluntary Application Server Identification) keys are required for web push notifications. Generate them using:

   ```bash
   npx web-push generate-vapid-keys
   ```

   This will output:
   ```
   Public Key: <your-public-key>
   Private Key: <your-private-key>
   ```

   Or use an online tool: https://web-push-codelab.glitch.me/

2. **Configure Environment Variables**

   Add the following to your `.env` file:

   ```env
   VAPID_PUBLIC_KEY=your-vapid-public-key-here
   VAPID_PRIVATE_KEY=your-vapid-private-key-here
   VAPID_SUBJECT=mailto:admin@ofsp.com
   ```

   The `VAPID_SUBJECT` should be a mailto link or a URL identifying your application.

## Database Migration

After adding the `PushSubscription` model to the Prisma schema, run:

```bash
npm run prisma:migrate
npm run prisma:generate
```

## API Endpoints

### 1. Get VAPID Public Key

**GET** `/api/v1/notifications/push/public-key`

Returns the VAPID public key needed for client-side subscription.

**Response:**
```json
{
  "publicKey": "BKx..."
}
```

### 2. Subscribe to Push Notifications

**POST** `/api/v1/notifications/push/subscribe`

Subscribe a user's device to push notifications.

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "BNcRd...",
    "auth": "8HDd..."
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "user-id",
  "endpoint": "https://...",
  "createdAt": "2025-01-27T..."
}
```

### 3. Unsubscribe from Push Notifications

**POST** `/api/v1/notifications/push/unsubscribe`

Remove a push subscription.

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/..."
}
```

### 4. Get User Subscriptions

**GET** `/api/v1/notifications/push/subscriptions`

Get all push subscriptions for the authenticated user.

**Response:**
```json
[
  {
    "id": "uuid",
    "endpoint": "https://...",
    "userAgent": "Mozilla/5.0...",
    "deviceInfo": {...},
    "createdAt": "2025-01-27T..."
  }
]
```

## Frontend Integration

### 1. Request Permission

```javascript
const permission = await Notification.requestPermission();
if (permission === 'granted') {
  // Proceed with subscription
}
```

### 2. Get VAPID Public Key

```javascript
const response = await fetch('/api/v1/notifications/push/public-key');
const { publicKey } = await response.json();
```

### 3. Subscribe to Push Service

```javascript
const registration = await navigator.serviceWorker.ready;
const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: urlBase64ToUint8Array(publicKey),
});
```

### 4. Send Subscription to Backend

```javascript
await fetch('/api/v1/notifications/push/subscribe', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64(subscription.getKey('auth')),
    },
  }),
});
```

### 5. Handle Push Notifications (Service Worker)

```javascript
// service-worker.js
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const options = {
    title: data.title,
    body: data.body,
    icon: data.icon || '/icon-192x192.png',
    badge: data.badge || '/badge-72x72.png',
    data: data.data,
    actions: data.actions,
    requireInteraction: data.requireInteraction,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view' && event.notification.data?.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
```

## Usage in Backend Services

### Creating Notifications with Channels

The `NotificationHelperService` now supports channel specification:

```typescript
await notificationHelperService.createNotification({
  userId: 'user-id',
  type: 'ORDER',
  title: 'New Order',
  message: 'You have a new order',
  priority: 'HIGH',
  channels: ['web-push', 'in-app'], // Specify channels
  // ... other fields
});
```

**Default Behavior:**
- If `channels` is not specified, notifications are sent via `web-push` by default
- All notifications are also stored in the database (`in-app` channel)

### Notification Payload Structure

Web push notifications include:
- **title**: Notification title
- **message**: Notification body
- **icon**: Icon URL (defaults to `/icon-192x192.png`)
- **badge**: Badge icon URL (defaults to `/badge-72x72.png`)
- **data**: Custom data object (includes `url`, `entityType`, `entityId`)
- **actions**: Action buttons (if `actionUrl` and `actionLabel` provided)
- **requireInteraction**: Set to `true` for HIGH priority notifications
- **tag**: Notification tag for grouping (uses notification `type`)

## Troubleshooting

### "VAPID keys not configured"

**Solution:** Ensure `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` are set in your `.env` file.

### "Subscription expired or invalid"

**Solution:** This is handled automatically. Expired subscriptions are removed from the database when detected.

### Notifications not appearing

**Check:**
1. User has granted notification permission
2. Service worker is registered and active
3. VAPID keys are correctly configured
4. Subscription was successfully saved to database
5. Browser supports web push (Chrome, Firefox, Edge, Safari 16+)

### Testing VAPID Keys

You can test your VAPID keys using the web-push library:

```javascript
const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:admin@ofsp.com',
  'YOUR_PUBLIC_KEY',
  'YOUR_PRIVATE_KEY'
);

// Test with a subscription
webpush.sendNotification(subscription, JSON.stringify({
  title: 'Test',
  body: 'Test notification'
}));
```

## Security Considerations

1. **VAPID Keys**: Keep private key secure. Never expose it in client-side code.
2. **HTTPS Required**: Web push only works over HTTPS (or localhost for development).
3. **User Consent**: Always request permission before subscribing.
4. **Subscription Management**: Allow users to unsubscribe easily.

## Future Enhancements

- [ ] Email channel implementation
- [ ] SMS channel implementation
- [ ] Notification preferences per user
- [ ] Notification scheduling
- [ ] Rich media notifications
- [ ] Notification analytics
