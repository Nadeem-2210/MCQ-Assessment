/**
 * Email Service for sending assessment results
 * 
 * Note: This is a client-side implementation that prepares email data.
 * For production, you should implement a server-side API endpoint that
 * handles actual email sending using services like SendGrid, Resend, or AWS SES.
 */

interface EmailData {
  to: string;
  traineeName: string;
  assessmentName: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  completedAt: string;
  violations?: number;
}

interface EmailResult {
  success: boolean;
  message: string;
}

/**
 * Send results email to trainee
 * This uses a mailto link as a fallback - in production, use a proper email API
 */
export async function sendResultsEmail(data: EmailData): Promise<EmailResult> {
  const { to, traineeName, assessmentName, score, totalQuestions, passed, completedAt, violations } = data;
  const percentage = Math.round((score / totalQuestions) * 100);
  const formattedDate = new Date(completedAt).toLocaleString();

  // Try to use the API endpoint if available
  try {
    const response = await fetch('/api/send-results-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      return { success: true, message: 'Email sent successfully!' };
    }
    
    // If API fails, fall back to mailto
    throw new Error('API not available');
  } catch {
    // Fallback: Open mailto link
    const subject = `Assessment Results: ${assessmentName}`;
    const body = `
Dear ${traineeName},

Thank you for completing the "${assessmentName}" assessment.

Your Results:
- Score: ${score}/${totalQuestions} (${percentage}%)
- Status: ${passed ? 'PASSED ✓' : 'NOT PASSED'}
- Completed: ${formattedDate}
${violations && violations > 0 ? `- Violations Recorded: ${violations}` : ''}

${passed 
  ? 'Congratulations on passing the assessment! You have demonstrated your proficiency in this subject area.'
  : 'Unfortunately, you did not meet the 60% passing threshold. You may review the material and try again.'
}

Best regards,
Kadel Labs Assessment Team
    `.trim();

    const mailtoLink = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Open mailto in a new window/tab
    window.open(mailtoLink, '_blank');
    
    return { 
      success: true, 
      message: 'Email client opened. Please send the email manually.' 
    };
  }
}

/**
 * Generate email content for results
 */
export function generateResultsEmailHTML(data: EmailData): string {
  const { traineeName, assessmentName, score, totalQuestions, passed, completedAt, violations } = data;
  const percentage = Math.round((score / totalQuestions) * 100);
  const formattedDate = new Date(completedAt).toLocaleString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Assessment Results</title>
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <div style="background: white; width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 15px;">
      <span style="font-size: 32px; font-weight: bold; color: #1e40af;">K</span>
    </div>
    <h1 style="color: white; margin: 0; font-size: 24px;">Kadel Labs</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0;">Assessment Results</p>
  </div>
  
  <div style="background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; border-top: none;">
    <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${traineeName}</strong>,</p>
    
    <p style="margin-bottom: 20px;">Thank you for completing the assessment. Here are your results:</p>
    
    <div style="background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
      <h2 style="color: #1e40af; margin: 0 0 15px; font-size: 18px;">${assessmentName}</h2>
      
      <div style="text-align: center; padding: 20px 0;">
        <div style="font-size: 48px; font-weight: bold; color: ${passed ? '#059669' : '#dc2626'};">
          ${percentage}%
        </div>
        <div style="color: #64748b; font-size: 14px;">
          ${score} out of ${totalQuestions} correct
        </div>
      </div>
      
      <div style="background: ${passed ? '#dcfce7' : '#fee2e2'}; color: ${passed ? '#166534' : '#991b1b'}; padding: 12px; border-radius: 6px; text-align: center; font-weight: 600;">
        ${passed ? '✓ PASSED' : '✗ NOT PASSED'}
      </div>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Completed</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 500;">${formattedDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Passing Score</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 500;">60%</td>
      </tr>
      ${violations && violations > 0 ? `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Violations</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 500; color: #dc2626;">${violations}</td>
      </tr>
      ` : ''}
    </table>
    
    <p style="color: #64748b; font-size: 14px;">
      ${passed 
        ? 'Congratulations on passing! You have demonstrated your proficiency in this subject area.'
        : 'You did not meet the passing threshold. Please review the material and try again when ready.'
      }
    </p>
  </div>
  
  <div style="padding: 20px; text-align: center; color: #94a3b8; font-size: 12px;">
    <p style="margin: 0;">© ${new Date().getFullYear()} Kadel Labs. All rights reserved.</p>
    <p style="margin: 5px 0 0;">This is an automated message from the Kadel Labs Assessment Platform.</p>
  </div>
</body>
</html>
  `;
}

/**
 * Prepare email data from attempt information
 */
export function prepareEmailData(
  email: string,
  traineeName: string,
  assessmentName: string,
  score: number,
  totalQuestions: number,
  completedAt: string,
  violations?: number
): EmailData {
  const percentage = (score / totalQuestions) * 100;
  
  return {
    to: email,
    traineeName,
    assessmentName,
    score,
    totalQuestions,
    passed: percentage >= 60,
    completedAt,
    violations,
  };
}
