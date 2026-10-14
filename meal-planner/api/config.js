// Public settings the app needs: the key for push notifications.
export default function handler(req, res) {
  res.setHeader('cache-control', 'no-store');
  res.status(200).json({
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    sync: !!process.env.BLOB_READ_WRITE_TOKEN,
  });
}
