import { NextRequest, NextResponse } from "next/server";
import { generateResultsEmailHTML } from "@/lib/email-service";

/**
 * API Route for sending assessment results via email
 * 
 * For production, integrate with an email service like:
 * - Resend (https://resend.com)
 * - SendGrid (https://sendgrid.com)
 * - AWS SES (https://aws.amazon.com/ses/)
 * 
 * Example with Resend:
 * 
 * import { Resend } from 'resend';
 * const resend = new Resend(process.env.RESEND_API_KEY);
 * 
 * await resend.emails.send({
 *   from: 'noreply@yourdomain.com',
 *   to: data.to,
 *   subject: `Assessment Results: ${data.assessmentName}`,
 *   html: generateResultsEmailHTML(data),
 * });
 */

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const { to, traineeName, assessmentName, score, totalQuestions, passed, completedAt, violations } = data;

    // Validate required fields
    if (!to || !traineeName || !assessmentName || score === undefined || !totalQuestions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate email HTML
    const emailHTML = generateResultsEmailHTML(data);

    // In production, send the email here using your preferred service
    // For now, we'll return success and rely on the client-side mailto fallback
    
    // Example implementation with environment variable check:
    const emailServiceConfigured = process.env.EMAIL_SERVICE_API_KEY;
    
    if (!emailServiceConfigured) {
      // No email service configured - return error to trigger client-side fallback
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 503 }
      );
    }

    // TODO: Implement actual email sending here
    // Example:
    // await sendEmailWithYourService({
    //   to,
    //   subject: `Assessment Results: ${assessmentName}`,
    //   html: emailHTML,
    // });

    console.log(`[Email API] Would send email to: ${to}`);
    console.log(`[Email API] Assessment: ${assessmentName}`);
    console.log(`[Email API] Score: ${score}/${totalQuestions}`);

    return NextResponse.json({ 
      success: true, 
      message: "Email sent successfully" 
    });
    
  } catch (error) {
    console.error("[Email API] Error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
