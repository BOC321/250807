// Email service for Maileroo integration

import axios from 'axios';

interface MailerooConfig {
  apiKey: string;
  baseUrl: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export class MailerooService {
  private config: MailerooConfig;

  constructor(apiKey: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://smtp.maileroo.com/api/v1'
    };
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const response = await axios.post(
        `${this.config.baseUrl}/send`,
        {
          from: options.from || 'noreply@yoursite.com',
          to: options.to,
          subject: options.subject,
          html: options.html
        },
        {
          headers: {
            'X-API-Key': this.config.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.success === true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  /**
   * Send survey report via email
   */
  async sendSurveyReport(
    email: string,
    surveyTitle: string,
    reportUrl: string,
    respondentName?: string
  ): Promise<boolean> {
    const subject = `Your Survey Report: ${surveyTitle}`;
    
    const html = `
      <html>
        <body>
          <h2>Your Survey Report</h2>
          <p>Hello${respondentName ? ` ${respondentName}` : ''},</p>
          <p>Thank you for completing the survey "${surveyTitle}".</p>
          <p>You can view your detailed report by clicking the link below:</p>
          <p><a href="${reportUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Report</a></p>
          <p>If the button doesn't work, please copy and paste this link into your browser: ${reportUrl}</p>
          <br>
          <p>Best regards,<br>The Survey Team</p>
        </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: subject,
      html: html
    });
  }
}

// Initialize the service with the API key from environment variables
export const mailerooService = new MailerooService(
  process.env.MAILEROO_API_KEY || ''
);
