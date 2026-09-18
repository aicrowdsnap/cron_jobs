import nodemailer from 'nodemailer';

export async function sendNotificationEmail(subject: string, htmlMessage: string) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM_EMAIL,
    to: process.env.ADMIN_EMAIL,
    subject: subject,
    html: htmlMessage,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Email] Notification sent: ${subject}`);
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
  }
}