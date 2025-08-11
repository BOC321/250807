// Email service for external email providers

export class EmailService {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  /**
   * Send an email
   */
  async sendEmail(options: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }): Promise<boolean> {
    try {
      // Basic email validation
      if (!options.to || !options.subject || !options.html) {
        throw new Error('Missing required email fields');
      }

      // For now, return success
      // In a real implementation, this would integrate with an email service
      console.log('Email would be sent:', {
        to: options.to,
        subject: options.subject,
        html: options.html,
      });

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send survey completion email
   */
  async sendSurveyCompletionEmail(
    recipientEmail: string,
    surveyTitle: string,
    resultLink?: string
  ): Promise<boolean> {
    const subject = `Survey Completed: ${surveyTitle}`;
    const html = `
      <h2>Survey Completed Successfully</h2>
      <p>Thank you for completing the survey: <strong>${surveyTitle}</strong></p>
      ${resultLink ? `<p>You can view your results here: <a href="${resultLink}">${resultLink}</a></p>` : ''}
      <p>Thank you for your participation!</p>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
    });
  }

  /**
   * Send survey invitation email
   */
  async sendSurveyInvitationEmail(
    recipientEmail: string,
    surveyTitle: string,
    surveyLink: string,
    message?: string
  ): Promise<boolean> {
    const subject = `Invitation to Complete Survey: ${surveyTitle}`;
    const html = `
      <h2>Survey Invitation</h2>
      <p>You have been invited to complete the survey: <strong>${surveyTitle}</strong></p>
      ${message ? `<p>${message}</p>` : ''}
      <p>Please click the link below to start the survey:</p>
      <p><a href="${surveyLink}">${surveyLink}</a></p>
      <p>Thank you for your participation!</p>
    `;

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
    });
  }
}

// Maileroo-specific implementation
export class MailerooService extends EmailService {
  constructor(apiKey: string) {
    super({
      apiKey,
      baseUrl: 'https://smtp.maileroo.com/api/v1',
    });
  }
}
