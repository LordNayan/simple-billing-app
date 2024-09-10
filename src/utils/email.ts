import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = "";

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const sendEmailNotification = async (
  emailPayload: EmailOptions
): Promise<void> => {
  try {
    const { to, subject, text, html = "" } = emailPayload;
    sgMail.setApiKey(SENDGRID_API_KEY);

    const msg = {
      to,
      from: "your_send_grid_registered_email@sendgrid.com",
      subject,
      text,
      html,
    };

    await sgMail.send(msg);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
