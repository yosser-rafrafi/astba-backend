const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

try {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4' });
    const outputPath = path.join(__dirname, 'test-certificate.pdf');
    const stream = fs.createWriteStream(outputPath);

    doc.pipe(stream);

    // --- PDF Content Design (Copied from route) ---

    // Background / Border
    doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke('#1e3a8a');
    doc.rect(25, 25, doc.page.width - 50, doc.page.height - 50).stroke('#1e3a8a');

    // Header
    const logoPath = path.join(__dirname, 'assets/logo.png'); // Adjusted path for root execution

    if (fs.existsSync(logoPath)) {
        console.log('Logo found, adding to PDF');
        doc.image(logoPath, 50, 50, { width: 100 }).moveDown();
    } else {
        console.log('Logo NOT found, skipping');
        doc.moveDown();
    }

    doc.font('Helvetica-Bold').fontSize(40).fillColor('#1e3a8a').text('CERTIFICATE OF COMPLETION', 0, 100, { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica').fontSize(20).fillColor('#000000').text('This is to certify that', { align: 'center' });
    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(35).fillColor('#1e3a8a').text('Test Student', { align: 'center' });
    doc.end();

    stream.on('finish', () => {
        console.log('PDF generated successfully at ' + outputPath);
    });

} catch (error) {
    console.error('Error generating PDF:', error);
}
