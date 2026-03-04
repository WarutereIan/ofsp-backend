SMS Notifications
The SMS API sends a notification when a specific event happens. To receive these notifications you need to setup a callback URL depending on the type of notification you would like to receive. These requests are sent as a POST request to the URL provided, as application/x-www-form-urlencoded.

Our implementation (OFSP backend)
- **Delivery reports only:** We implement the **Delivery Reports** callback. Configure in Africa's Talking: SMS → SMS Callback URLs → Delivery Reports.
- **Callback URL:** `https://<your-api-host>/api/v1/notifications/sms-delivery-callback`
- **Method:** POST. Body is `application/x-www-form-urlencoded` (NestJS parses it into `req.body`).
- **We use:** `id` (same as the messageId in the send response), `status`, and optionally `phoneNumber`. We look up `SmsDeliveryReport` by `providerMessageId` = `id`, update `status` and `rawPayload`. When `status` is **Success** (see below: "delivered to receiver's handset") and the notification is for an advisory (`entityType` ADVISORY), we increment `Advisory.smsDeliveredCount`. We also treat the string `Delivered` as delivered if present.
- **Incoming / Opt-out / Subscription:** Not implemented; only delivery reports are handled.

Types of SMS Notifications
SMS API notifications are sent for various SMS categories as shown below:

Category
Delivery reports
Sent whenever the mobile service provider confirms or rejects delivery of a message.
Incoming messages
Sent whenever a message is sent to any of your registered shortcodes.
Bulk SMS Opt Out
Sent whenever a user opts out of receiving messages from your alphanumeric sender ID.
Subscription Notifications
Sent whenever someone subscribes or unsubscribes from any of your premium SMS products.
Delivery Reports
To receive delivery reports, you need to set a delivery report callback URL. From the dashboard select SMS -> SMS Callback URLs -> Delivery Reports.

Delivery Report notification contents (we use `id`, `status`, and store full payload as `rawPayload`)

Field
id String
A unique identifier for each message. This is the same id as the one in the response when a message is sent.
status String
The status of the message. Possible values are:
Sent: The message has successfully been sent by our network.
Submitted: The message has successfully been submitted to the MSP (Mobile Service Provider).
Buffered: The message has been queued by the MSP.
Rejected: The message has been rejected by the MSP. This is a final status.
Success: The message has successfully been delivered to the receiver’s handset. This is a final status.
Failed: The message could not be delivered to the receiver’s handset. This is a final status.
AbsentSubscriber: The message was not delivered since user’s SIM card was not reachable on the network either phone was off or in a place with no network coverage.
Expired: The message was discarded by the telco as it was flagged, either some content in the message or the sender ID use was flagged on their firewall.
phoneNumber String
This is phone number that the message was sent out to.
networkCode String
A unique identifier for the telco that handled the message. Possible values are:
62120: Airtel Nigeria
62130: MTN Nigeria
62150: Glo Nigeria
62160: Etisalat Nigeria
63510: MTN Rwanda
63513: Tigo Rwanda
63514: Airtel Rwanda
63902: Safaricom
63903: Airtel Kenya
63907: Orange Kenya
63999: Equitel Kenya
64002: Tigo Tanzania
64003: Zantel Tanzania
64004: Vodacom Tanzania
64005: Airtel Tanzania
64007: TTCL Tanzania
64009: Halotel Tanzania
64101: Airtel Uganda
64110: MTN Uganda
64111: UTL Uganda
64114: Africell Uganda
65001: TNM Malawi
65010: Airtel Malawi
99999: Athena (This is a custom networkCode that only applies when working in the sandbox environment).
failureReason String Optional
Only provided if status is Rejected or Failed. Possible values are:
InsufficientCredit: This occurs when the subscriber doesn’t have enough airtime for a premium subscription service/message
InvalidLinkId: This occurs when a message is sent with an invalid linkId for an onDemand service
UserIsInactive: This occurs when the subscriber is inactive or the account deactivated by the MSP (Mobile Service Provider).
UserInBlackList: This occurs if the user has been blacklisted not to receive messages from a particular service (shortcode or keyword)
UserAccountSuspended: This occurs when the mobile subscriber has been suspended by the MSP.
NotNetworkSubcriber: This occurs when the message is passed to an MSP where the subscriber doesn’t belong.
UserNotSubscribedToProduct: This occurs when the message from a subscription product is sent to a phone number that has not subscribed to the product.
UserDoesNotExist: This occurs when the message is sent to a non-existent mobile number.
DeliveryFailure: This occurs when message delivery fails for any reason not listed above or where the MSP didn’t provide a delivery failure reason.
DoNotDisturbRejection: Note: This only applies to Nigeria. When attempting to send an SMS message with a promotional sender ID outside the allowed time window(8pm-8am), the API will return an HTTP 409 status code, indicating a conflict. This error code signifies that the request conflicts with the predefined time restrictions for promotional sender IDs by the NCC. Example Response: {"SMSMessageData":{"Message":"Sent to 0/1 Total Cost: 0","Recipients":[{"cost":"0","messageId":"None","number":"+2348XXXXXXX","status":"DoNotDisturbRejection","statusCode":409}]}}
retryCount Integer
Number of times the request to send a message to the device was retried before it succeeded or definitely failed. Note: This only applies for premium SMS messages.
Incoming Messages
To receive incoming messages, you need to set an incoming messages callback URL. From the dashboard select SMS -> SMS Callback URLs -> Incoming Messages.

Incoming message notification contents

Field
date String
The date and time when the message was received.
from String
The number that sent the message.
id String
The internal ID that we use to store this message.
linkId String Optional
Field required when responding to an on-demand user request with a premium message.
text String
The message content.
to String
The number to which the message was sent.
cost String: Amount incurred to send this sms. The format of this string is: (3-digit Currency Code)(space)(Decimal Value) e.g KES 1.00
networkCode String
A unique identifier for the telco that handled the message. Possible values are:
62120: Airtel Nigeria
62130: MTN Nigeria
62150: Glo Nigeria
62160: Etisalat Nigeria
63510: MTN Rwanda
63513: Tigo Rwanda
63514: Airtel Rwanda
63902: Safaricom
63903: Airtel Kenya
63907: Orange Kenya
63999: Equitel Kenya
64002: Tigo Tanzania
64003: Zantel Tanzania
64004: Vodacom Tanzania
64005: Airtel Tanzania
64007: TTCL Tanzania
64009: Halotel Tanzania
64101: Airtel Uganda
64110: MTN Uganda
64111: UTL Uganda
64114: Africell Uganda
65001: TNM Malawi
65010: Airtel Malawi
99999: Athena (This is a custom networkCode that only applies when working in the sandbox environment).
Bulk SMS Opt Out
To receive bulk sms opt out notifications, you need to set a bulk sms opt out callback URL. From the dashboard select SMS -> SMS Callback URLs -> Bulk SMS Opt Out.

The instructions on how to opt out are automatically appended to the first message you send to the mobile subscriber. From then onwards, any other message will be sent ‘as is’ to the subscriber.

Bulk sms opt out notification contents

Field
senderId String
This is the shortcode/alphanumeric sender id the user opted out from.
phoneNumber String
This will contain the phone number of the subscriber who opted out.
Subscription Notification
To receive premium sms subscription notifications, you need to set a subscription notification callback URL. From the dashboard select SMS -> SMS Callback URLs -> Subscription Notifications.

Subscription notification contents

Field
phoneNumber String
Phone number to subscribe or unsubscribe.
shortCode String
The short code that has this product.
keyword String
The keyword of the product that the user has subscribed or unsubscribed from.
updateType String
The type of the update. The value could either be addition or deletion.