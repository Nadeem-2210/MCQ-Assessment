/**
 * PDF Certificate Generator
 * Generates completion certificates for passed assessments
 */

interface CertificateData {
  traineeName: string;
  assessmentName: string;
  score: number;
  totalQuestions: number;
  completedAt: string;
  certificateId?: string;
}

export function generateCertificatePDF(data: CertificateData): void {
  const { traineeName, assessmentName, score, totalQuestions, completedAt, certificateId } = data;
  const percentage = Math.round((score / totalQuestions) * 100);
  const formattedDate = new Date(completedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  // Generate a unique certificate ID if not provided
  const certId = certificateId || `CERT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow pop-ups to generate the certificate");
    return;
  }

  // Certificate HTML template
  const certificateHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate of Completion - ${traineeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Open+Sans:wght@400;600&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: landscape;
      margin: 0;
    }
    
    body {
      font-family: 'Open Sans', sans-serif;
      background: #f5f5f5;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    .certificate {
      width: 1056px;
      height: 816px;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
      border: 3px solid #1e40af;
      position: relative;
      padding: 60px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.15);
    }
    
    .certificate::before {
      content: '';
      position: absolute;
      top: 15px;
      left: 15px;
      right: 15px;
      bottom: 15px;
      border: 2px solid #3b82f6;
      pointer-events: none;
    }
    
    .certificate::after {
      content: '';
      position: absolute;
      top: 25px;
      left: 25px;
      right: 25px;
      bottom: 25px;
      border: 1px solid #93c5fd;
      pointer-events: none;
    }
    
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    
    .logo {
      width: 80px;
      height: 80px;
      background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);
    }
    
    .logo span {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      font-weight: 700;
      color: white;
    }
    
    .company-name {
      font-family: 'Playfair Display', serif;
      font-size: 28px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 10px;
    }
    
    .certificate-title {
      font-family: 'Playfair Display', serif;
      font-size: 48px;
      font-weight: 700;
      color: #1e3a5f;
      margin: 30px 0 15px;
      letter-spacing: 2px;
    }
    
    .subtitle {
      font-size: 16px;
      color: #64748b;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    
    .content {
      text-align: center;
      margin-top: 40px;
    }
    
    .presented-to {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      margin-bottom: 15px;
    }
    
    .trainee-name {
      font-family: 'Playfair Display', serif;
      font-size: 42px;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 30px;
      border-bottom: 3px solid #3b82f6;
      display: inline-block;
      padding-bottom: 10px;
    }
    
    .achievement-text {
      font-size: 16px;
      color: #475569;
      max-width: 700px;
      margin: 0 auto 30px;
      line-height: 1.8;
    }
    
    .assessment-name {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 20px;
    }
    
    .score-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      color: white;
      padding: 12px 30px;
      border-radius: 50px;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 30px;
      box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
    }
    
    .footer {
      position: absolute;
      bottom: 60px;
      left: 60px;
      right: 60px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    
    .signature-block {
      text-align: center;
    }
    
    .signature-line {
      width: 200px;
      border-bottom: 2px solid #1e40af;
      margin-bottom: 10px;
    }
    
    .signature-title {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .date-block {
      text-align: center;
    }
    
    .date-value {
      font-size: 16px;
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 5px;
    }
    
    .date-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .certificate-id {
      position: absolute;
      bottom: 30px;
      right: 60px;
      font-size: 10px;
      color: #94a3b8;
      letter-spacing: 1px;
    }
    
    .decorative-corner {
      position: absolute;
      width: 100px;
      height: 100px;
      opacity: 0.1;
    }
    
    .corner-tl {
      top: 40px;
      left: 40px;
      border-left: 4px solid #1e40af;
      border-top: 4px solid #1e40af;
    }
    
    .corner-tr {
      top: 40px;
      right: 40px;
      border-right: 4px solid #1e40af;
      border-top: 4px solid #1e40af;
    }
    
    .corner-bl {
      bottom: 40px;
      left: 40px;
      border-left: 4px solid #1e40af;
      border-bottom: 4px solid #1e40af;
    }
    
    .corner-br {
      bottom: 40px;
      right: 40px;
      border-right: 4px solid #1e40af;
      border-bottom: 4px solid #1e40af;
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      
      .certificate {
        box-shadow: none;
        width: 100%;
        height: 100vh;
      }
    }
    
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #1e40af;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 4px 15px rgba(30, 64, 175, 0.3);
      z-index: 1000;
    }
    
    .print-btn:hover {
      background: #1e3a8a;
    }
    
    @media print {
      .print-btn {
        display: none;
      }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">📄 Print / Save as PDF</button>
  
  <div class="certificate">
    <div class="decorative-corner corner-tl"></div>
    <div class="decorative-corner corner-tr"></div>
    <div class="decorative-corner corner-bl"></div>
    <div class="decorative-corner corner-br"></div>
    
    <div class="header">
      <div class="logo">
        <span>K</span>
      </div>
      <div class="company-name">Kadel Labs</div>
      <div class="subtitle">Assessment Platform</div>
    </div>
    
    <div class="certificate-title">Certificate of Completion</div>
    
    <div class="content">
      <div class="presented-to">This is to certify that</div>
      <div class="trainee-name">${escapeHtml(traineeName)}</div>
      <div class="achievement-text">
        has successfully completed the assessment and demonstrated proficiency in
      </div>
      <div class="assessment-name">"${escapeHtml(assessmentName)}"</div>
      <div class="score-badge">
        ✓ Score: ${score}/${totalQuestions} (${percentage}%)
      </div>
    </div>
    
    <div class="footer">
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-title">Authorized Signature</div>
      </div>
      
      <div class="date-block">
        <div class="date-value">${formattedDate}</div>
        <div class="date-label">Date of Completion</div>
      </div>
    </div>
    
    <div class="certificate-id">Certificate ID: ${certId}</div>
  </div>
</body>
</html>
  `;

  printWindow.document.write(certificateHTML);
  printWindow.document.close();
}

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function canGenerateCertificate(score: number, totalQuestions: number): boolean {
  const percentage = (score / totalQuestions) * 100;
  return percentage >= 60; // 60% pass threshold
}
