const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

try {
    const doc = new PDFDocument({
        layout: 'landscape',
        size: 'A4',
        margin: 0 // Full control
    });
    const outputPath = path.join(__dirname, 'test-certificate-single.pdf');
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // --- PDF Content Design ---
    const width = doc.page.width;
    const height = doc.page.height;

    // 1. Background / Border
    // Outer border
    doc.rect(20, 20, width - 40, height - 40)
        .lineWidth(3)
        .stroke('#1e3a8a'); // Dark Blue

    // Inner border
    doc.rect(30, 30, width - 60, height - 60)
        .lineWidth(1)
        .stroke('#1e3a8a');

    // Ornamental corners (Simple lines for elegance)
    doc.save()
        .moveTo(40, 40).lineTo(100, 40).stroke()
        .moveTo(40, 40).lineTo(40, 100).stroke()

        .moveTo(width - 40, 40).lineTo(width - 100, 40).stroke()
        .moveTo(width - 40, 40).lineTo(width - 40, 100).stroke()

        .moveTo(40, height - 40).lineTo(40, height - 100).stroke()
        .moveTo(40, height - 40).lineTo(100, height - 40).stroke()

        .moveTo(width - 40, height - 40).lineTo(width - 40, height - 100).stroke()
        .moveTo(width - 40, height - 40).lineTo(width - 100, height - 40).stroke()
        .restore();

    // 2. Header (Logo)
    const logoPath = path.join(__dirname, 'assets/logo.png'); // Adjusted for root run

    // Center logic
    let centerY = 140;

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, width / 2 - 50, 60, { width: 100 });
    } else {
        // Placeholder text if logo missing
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#1e3a8a')
            .text('ASTBA', 0, 80, { align: 'center' });
    }

    // 3. Title
    doc.font('Helvetica-Bold').fontSize(40).fillColor('#1e3a8a')
        .text('CERTIFICATE OF COMPLETION', 0, 160, { align: 'center' });

    // 4. Subtitle
    doc.font('Helvetica').fontSize(18).fillColor('#4b5563') // Gray-600
        .text('This certificate is proudly presented to', 0, 220, { align: 'center' });

    // 5. Student Name (Large & Elegant)
    doc.font('Helvetica-Bold').fontSize(36).fillColor('#1e40af') // Blue-800
        .text('Test Student Name', 0, 260, { align: 'center' });

    // Underline name
    const nameWidth = doc.widthOfString('Test Student Name');
    doc.moveTo(width / 2 - nameWidth / 2 - 20, 305)
        .lineTo(width / 2 + nameWidth / 2 + 20, 305)
        .lineWidth(1)
        .strokeColor('#9ca3af') // Gray-400
        .stroke();

    // 6. Body Text
    doc.font('Helvetica').fontSize(18).fillColor('#4b5563')
        .text('for successfully completing the comprehensive training course', 0, 330, { align: 'center' });

    // 7. Formation Title
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#111827') // Gray-900
        .text('Fullstack Development Bootcamp', 0, 370, { align: 'center' });

    // 8. Date & ID
    doc.font('Helvetica').fontSize(14).fillColor('#6b7280')
        .text(`Awarded on ${new Date().toLocaleDateString()}`, 0, 420, { align: 'center' });

    // 9. Signatures
    const signatureY = height - 120;

    // Director
    doc.moveTo(100, signatureY).lineTo(300, signatureY).strokeColor('#000000').stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#000000')
        .text('Director Signature', 100, signatureY + 10, { width: 200, align: 'center' });

    // Formateur
    doc.moveTo(width - 300, signatureY).lineTo(width - 100, signatureY).stroke();
    doc.font('Helvetica-Bold').fontSize(14)
        .text('Formateur Signature', width - 300, signatureY + 10, { width: 200, align: 'center' });

    doc.end();

    stream.on('finish', () => {
        console.log('Single-page PDF generated successfully at ' + outputPath);
    });

} catch (error) {
    console.error('Error generating PDF:', error);
}
