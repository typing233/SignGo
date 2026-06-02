import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "1025"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendSigningInvitation({
  to,
  signerName,
  documentName,
  senderName,
  signUrl,
}: {
  to: string;
  signerName: string;
  documentName: string;
  senderName: string;
  signUrl: string;
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "SignGo <noreply@signgo.local>",
    to,
    subject: `${senderName} 邀请您签署文档「${documentName}」`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a;">文档签署邀请</h2>
        <p>您好，${signerName}：</p>
        <p><strong>${senderName}</strong> 邀请您签署文档「<strong>${documentName}</strong>」。</p>
        <p>请点击下方按钮查看并签署文档：</p>
        <a href="${signUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; margin: 16px 0;">
          查看并签署
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 24px;">如果按钮无法点击，请复制以下链接到浏览器：</p>
        <p style="color: #666; font-size: 14px; word-break: break-all;">${signUrl}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #999; font-size: 12px;">此邮件由 SignGo 自动发送，请勿回复。</p>
      </div>
    `,
  });
}
