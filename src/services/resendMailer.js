import sgMail from '@sendgrid/mail';

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Email templates for different scenarios
const EMAIL_TEMPLATES = {
    // OTP email template for two-factor authentication
    OTP: {
        subject: "Your OTP Code - NPC Smart Report",
        text: (data) => `Your OTP code is ${data.otp}. It is valid for 10 minutes.`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">NPC Smart Report System</h2>
                <p>Your One-Time Password (OTP) is:</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="font-size: 32px; margin: 0; color: #2563eb; letter-spacing: 5px;">${data.otp}</h1>
                </div>
                <p>This OTP is valid for 60 minutes. Do not share it with anyone.</p>
                <p>If you didn't request this OTP, please ignore this email.</p>
            </div>
        `
    },

    // Password reset email template
    PASSWORD_RESET: {
        subject: "Reset Your Password - NPC Smart Report",
        text: (data) => `Click the link to reset your password: ${data.resetLink}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Password Reset Request</h2>
                <p>You requested to reset your password. Click the button below to proceed:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.resetLink}" 
                       style="background: #2563eb; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                </div>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #2563eb;">${data.resetLink}</p>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request a password reset, please ignore this email.</p>
            </div>
        `
    },

    // Login notification email template
    LOGIN_NOTIFICATION: {
        subject: "New Login Detected - NPC Smart Report",
        text: (data) => `New login detected for your account from ${data.device} at ${data.time}.`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">New Login Detected</h2>
                <p>A new login was detected for your Smart Report account:</p>
                <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>Time:</strong> ${data.time}</p>
                    <p><strong>Device:</strong> ${data.device}</p>
                    <p><strong>Location:</strong> ${data.location}</p>
                </div>
                <p>If this was you, you can safely ignore this email.</p>
                <p>If you don't recognize this activity, please secure your account immediately.</p>
            </div>
        `
    },

    // Reminder email template
    REMINDER: {
        subject: "Reminder - NPC Smart Report",
        text: (data) => `Reminder: ${data.message}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Reminder</h2>
                <p>${data.message}</p>
                ${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate}</p>` : ''}
                ${data.actionLink ? `
                    <div style="text-align: center; margin: 20px 0;">
                        <a href="${data.actionLink}" 
                           style="background: #2563eb; color: white; padding: 12px 24px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Take Action
                        </a>
                    </div>
                ` : ''}
            </div>
        `
    },

    // Welcome email template for new users
    WELCOME: {
        subject: "Welcome to NPC Smart Report!",
        text: (data) => `Welcome ${data.name}! Your account has been created successfully.`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Welcome to NPC Smart Report!</h2>
                <p>Hello ${data.name},</p>
                <p>Your account has been created successfully. Welcome to our platform!</p>
                <p>You can now login and start using Smart Report.</p>
                ${data.temporaryPassword ? `
                    <div style="background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>Temporary Password:</strong> ${data.temporaryPassword}</p>
                        <p>Please change your password after first login.</p>
                    </div>
                ` : ''}
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.link}" 
                       style="background: #2563eb; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Your Email
                    </a>
                </div>
            </div>
        `
    },

    // Account activation confirmation email template
    ACCOUNT_ACTIVATED: {
        subject: "Account Activated - NPC Smart Report",
        text: (data) => `Your account has been activated successfully.`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #16a34a;">Account Activated</h2>
                <p>Your NPC Smart Report account has been activated successfully!</p>
                <p>You can now login and access all features.</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.loginLink}" 
                       style="background: #16a34a; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Login to Your Account
                    </a>
                </div>
            </div>
        `
    },

    // Email verification template (specifically for your signup flow)
    EMAIL_VERIFICATION: {
        subject: "Verify Your Email - NPC Smart Report",
        text: (data) => `Hello ${data.name}, please verify your email by clicking: ${data.verificationUrl}`,
        html: (data) => `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Verify Your Email Address</h2>
                <p>Hello ${data.name},</p>
                <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${data.verificationUrl}" 
                       style="background: #2563eb; color: white; padding: 12px 24px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        Verify Email Address
                    </a>
                </div>
                <p>Or copy and paste this link in your browser:</p>
                <p style="word-break: break-all; color: #2563eb; background: #f3f4f6; padding: 10px; border-radius: 5px;">
                    ${data.verificationUrl}
                </p>
                <p>This link will expire in 24 hours.</p>
                <p>If you didn't create an account, please ignore this email.</p>
            </div>
        `
    }
};

/**
 * Send email using predefined templates with SendGrid
 * @param {string} email - Recipient email address
 * @param {string} templateType - Type of email template (OTP, PASSWORD_RESET, etc.)
 * @param {object} data - Data to be used in the template
 * @param {object} options - Additional options (cc, bcc, attachments, etc.)
 * @returns {Promise} Result of email sending operation
 */
export const sendEmail = async (email, templateType, data = {}, options = {}) => {
    try {
        const template = EMAIL_TEMPLATES[templateType];
        
        // Validate template existence
        if (!template) {
            throw new Error(`Email template '${templateType}' not found`);
        }

        // Validate SendGrid API key
        if (!process.env.SENDGRID_API_KEY) {
            throw new Error("SENDGRID_API_KEY environment variable is required");
        }

        const mailOptions = {
            from: process.env.SENDGRID_FROM_EMAIL || 'noreply@npcsmartreport.com',
            to: email,
            subject: template.subject,
            text: template.text(data),
            html: template.html(data),
            ...options
        };

        const result = await sgMail.send(mailOptions);
        
        console.log(`✅ ${templateType} email sent to ${email}`);
        return result;
    } catch (error) {
        console.error(`❌ Failed to send ${templateType} email to ${email}:`, error);
        throw new Error(`Failed to send ${templateType.toLowerCase()} email: ${error.message}`);
    }
};

/**
 * Send email to multiple recipients with SendGrid
 * @param {string[]} emails - Array of recipient email addresses
 * @param {string} templateType - Type of email template
 * @param {object} data - Data to be used in the template
 * @param {object} options - Additional options
 * @returns {Promise} Result of bulk email sending operation
 */
export const sendBulkEmail = async (emails, templateType, data = {}, options = {}) => {
    try {
        const template = EMAIL_TEMPLATES[templateType];
        
        if (!template) {
            throw new Error(`Email template '${templateType}' not found`);
        }

        if (!process.env.SENDGRID_API_KEY) {
            throw new Error("SENDGRID_API_KEY environment variable is required");
        }

        // Send to each recipient individually for better tracking
        const results = [];
        for (const email of emails) {
            const mailOptions = {
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@npcsmartreport.com',
                to: email,
                subject: template.subject,
                text: template.text(data),
                html: template.html(data),
                ...options
            };

            try {
                const result = await sgMail.send(mailOptions);
                results.push({ email, success: true, result });
            } catch (error) {
                console.error(`Failed to send to ${email}:`, error);
                results.push({ email, success: false, error: error.message });
            }
        }

        const successful = results.filter(r => r.success).length;
        console.log(`✅ Bulk ${templateType} emails sent: ${successful}/${emails.length} successful`);
        return results;
    } catch (error) {
        console.error(`❌ Failed to send bulk ${templateType} emails:`, error);
        throw new Error(`Failed to send bulk ${templateType.toLowerCase()} emails: ${error.message}`);
    }
};

// Convenience service object for common email types
export const emailService = {
    /**
     * Send OTP email for two-factor authentication
     */
    sendOTP: (email, otp) => sendEmail(email, 'OTP', { otp }),
    
    /**
     * Send password reset email with reset link
     */
    sendPasswordReset: (email, resetLink) => sendEmail(email, 'PASSWORD_RESET', { resetLink }),

    /**
     * Send email verification link for new users
     */
    sendVerificationEmail: (email, name, verificationUrl) => 
        sendEmail(email, 'EMAIL_VERIFICATION', { name, verificationUrl }),
    
    /**
     * Send login notification for security awareness
     */
    sendLoginNotification: (email, device, time, location = 'Musanze') => 
        sendEmail(email, 'LOGIN_NOTIFICATION', { device, time, location }),
    
    /**
     * Send reminder email with optional due date and action link
     */
    sendReminder: (email, message, dueDate = null, actionLink = null) => 
        sendEmail(email, 'REMINDER', { message, dueDate, actionLink }),
    
    /**
     * Send welcome email to new users
     */
    sendWelcome: (email, name, loginLink, temporaryPassword = null) => 
        sendEmail(email, 'WELCOME', { name, loginLink, temporaryPassword }),
    
    /**
     * Send account activation confirmation email
     */
    sendAccountActivated: (email, loginLink) => 
        sendEmail(email, 'ACCOUNT_ACTIVATED', { loginLink }),

    /**
     * Test email service connectivity
     */
    testConnection: async () => {
        try {
            // Try to send a test email to verify configuration
            const testEmail = 'test@example.com';
            const result = await sgMail.send({
                from: process.env.SENDGRID_FROM_EMAIL || 'noreply@npcsmartreport.com',
                to: testEmail,
                subject: 'Test Email - NPC Smart Report',
                html: '<p>This is a test email to verify SendGrid configuration.</p>'
            });
            
            return { success: true, message: 'SendGrid configured successfully', data: result };
        } catch (error) {
            return { success: false, message: `SendGrid configuration failed: ${error.message}` };
        }
    }
};

export default emailService;