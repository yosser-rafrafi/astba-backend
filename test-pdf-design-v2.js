const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

try {
    const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 0
    });
    const outputPath = path.join(__dirname, 'test-certificate-v2.pdf');
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    const width = doc.page.width;
    const height = doc.page.height;

    // Define Colors
    const primaryBlue = '#0ea5e9'; // Sky blue/Cyan-ish from image
    const darkText = '#1f2937';    // Gray-900
    const lightText = '#6b7280';   // Gray-500

    // --- Background & Border ---
    // The image has a light blue border/frame effect. 
    // Let's create the double border with corner accents.

    const margin = 40;

    // Outer thin line
    doc.rect(margin, margin, width - (margin * 2), height - (margin * 2))
        .lineWidth(1)
        .stroke(primaryBlue);

    // Inner thicker line (or just double line)
    doc.rect(margin + 5, margin + 5, width - (margin * 2) - 10, height - (margin * 2) - 10)
        .lineWidth(2)
        .strokeOpacity(0.3)
        .stroke(primaryBlue);

    doc.strokeOpacity(1); // Reset

    // Corner Accents (L-shapes)
    const cornerSize = 30;
    const cornerMargin = margin - 10; // Slightly outside

    doc.lineWidth(2).strokeColor(primaryBlue);

    // Top Left
    doc.moveTo(cornerMargin, cornerMargin + cornerSize).lineTo(cornerMargin, cornerMargin).lineTo(cornerMargin + cornerSize, cornerMargin).stroke();
    // Top Right
    const trX = width - cornerMargin;
    doc.moveTo(trX - cornerSize, cornerMargin).lineTo(trX, cornerMargin).lineTo(trX, cornerMargin + cornerSize).stroke();
    // Bottom Left
    const blY = height - cornerMargin;
    doc.moveTo(cornerMargin, blY - cornerSize).lineTo(cornerMargin, blY).lineTo(cornerMargin + cornerSize, blY).stroke();
    // Bottom Right
    const brX = width - cornerMargin;
    doc.moveTo(brX - cornerSize, blY).lineTo(brX, blY).lineTo(brX, blY - cornerSize).stroke();


    // --- Content ---

    // 1. Icon / Medal (Top Center)
    // Drawing a simplified ribbon medal
    const centerX = width / 2;
    const topY = 100;

    doc.save();
    doc.translate(centerX, topY);
    // Ribbon
    doc.path('M -10 0 L -10 30 L 0 40 L 10 30 L 10 0 Z')
        .fill(primaryBlue);
    // Medal Circle
    doc.circle(0, 45, 12).fill(primaryBlue);
    // Star inside
    doc.fillColor('white').fontSize(12).text('★', -4, 39);
    doc.restore();

    // 2. Organization Name
    doc.font('Helvetica-Bold').fontSize(10).fillColor(primaryBlue)
        .text('ADVANCED SECURITY TRAINING & BALLISTICS ACADEMY', 0, 160, { align: 'center' });

    // 3. Main Title
    doc.font('Helvetica-Bold').fontSize(36).fillColor(darkText)
        .text('Certificate of Completion', 0, 190, { align: 'center' });

    // 4. Subtitle
    doc.font('Helvetica-Oblique').fontSize(14).fillColor(lightText)
        .text('This is to certify that', 0, 240, { align: 'center' });

    // 5. Student Name
    doc.font('Helvetica-Bold').fontSize(32).fillColor(darkText)
        .text('Alex Johnson', 0, 270, { align: 'center' });

    // Underline
    const nameWidth = doc.widthOfString('Alex Johnson');
    doc.moveTo(centerX - (nameWidth / 2) - 20, 310)
        .lineTo(centerX + (nameWidth / 2) + 20, 310)
        .lineWidth(1).strokeColor(primaryBlue).opacity(0.5).stroke();

    // 6. Body Text
    doc.font('Helvetica').fontSize(14).fillColor(lightText)
        .text('Has successfully completed the comprehensive', 0, 330, { align: 'center' });
    doc.text('professional training program in', 0, 350, { align: 'center' });

    // 7. Formation Title
    doc.font('Helvetica-Bold').fontSize(24).fillColor(primaryBlue)
        .text('ADVANCED TACTICAL TRAINING', 0, 380, { align: 'center' });

    // --- Footer Section ---
    const footerY = height - 100;

    // Director Signature (Left)
    doc.moveTo(100, footerY).lineTo(250, footerY).lineWidth(1).strokeColor(lightText).stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor(darkText)
        .text('DIRECTOR SIGNATURE', 100, footerY + 10, { width: 150, align: 'left' });
    doc.font('Helvetica').fontSize(8).fillColor(lightText)
        .text('Verification ID: ASTBA-99238-XQ', 100, footerY + 25, { width: 150, align: 'left' });

    // QR Code Placeholder (Center)
    doc.rect(centerX - 25, footerY - 20, 50, 50).strokeColor(lightText).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(primaryBlue)
        .text('SCAN TO VERIFY', centerX - 30, footerY + 35, { width: 60, align: 'center' });

    // Date (Right)
    doc.moveTo(width - 250, footerY).lineTo(width - 100, footerY).stroke();
    doc.font('Helvetica-Bold').fontSize(12).fillColor(darkText)
        .text('October 24, 2023', width - 250, footerY - 15, { width: 150, align: 'right' }); // Date above line typically? Or below. Image has date above? No, image has date big.

    // Adjusting Date based on image "October 24, 2023" big, "DATE OF ISSUE" small below
    doc.font('Helvetica-Bold').fontSize(14).fillColor(darkText)
        .text('October 24, 2023', width - 260, footerY - 25, { width: 160, align: 'center' }); // Actually let's place it roughly right

    doc.font('Helvetica-Bold').fontSize(8).fillColor(lightText)
        .text('DATE OF ISSUE', width - 260, footerY + 10, { width: 160, align: 'center' });


    doc.end();
    stream.on('finish', () => {
        console.log('Design V2 generated successfully at ' + outputPath);
    });

} catch (error) {
    console.error(error);
}
