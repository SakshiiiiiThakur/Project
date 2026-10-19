/**
 * build_word_doc.js
 * Reads data/sppu_knowledge.json and produces data/SPPU_Knowledge_Base.docx
 * Usage: node build_word_doc.js <path-to-json>
 */

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  LevelFormat, PageNumber, Footer, PageBreak
} = require("docx");
const fs = require("fs");
const path = require("path");

// ── args ─────────────────────────────────────────────────────────────────────
const jsonPath = process.argv[2];
if (!jsonPath || !fs.existsSync(jsonPath)) {
  console.error("Usage: node build_word_doc.js <path/to/sppu_knowledge.json>");
  process.exit(1);
}

const knowledge = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const outPath   = path.join(path.dirname(jsonPath), "SPPU_Knowledge_Base.docx");

// ── helpers ───────────────────────────────────────────────────────────────────
const border  = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function heading1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, bold: true, size: 36, color: "1F3864", font: "Arial" })],
    spacing: { before: 480, after: 240 },
  });
}

function heading2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 28, color: "2E5496", font: "Arial" })],
    spacing: { before: 300, after: 160 },
  });
}

function heading3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 24, color: "375623", font: "Arial" })],
    spacing: { before: 200, after: 120 },
  });
}

function bodyPara(text, opts = {}) {
  if (!text || !text.trim()) return null;
  return new Paragraph({
    children: [new TextRun({ text: text.trim(), size: 22, font: "Arial", ...opts })],
    spacing: { after: 120 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

function bulletItem(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    children: [new TextRun({ text: text.trim(), size: 22, font: "Arial" })],
    spacing: { after: 80 },
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BBBBBB", space: 1 } },
    spacing: { before: 160, after: 160 },
    children: [],
  });
}

function categoryBadge(cat) {
  const labels = {
    exam_form:    "Exam Form",
    scholarship:  "Scholarship",
    results:      "Results & CGPA",
    timetable:    "Timetable",
    clerical:     "Administrative",
    syllabus:     "Syllabus",
    student_portal: "Student Portal",
    affiliation:  "Rules & Attendance",
    admissions:   "Admissions",
    notices:      "Notices & Circulars",
    exam_circular:"Exam Circulars",
    general:      "General",
    contact:      "Contact",
  };
  return labels[cat] || cat;
}

// Splits multi-line static content into paragraphs/bullets
function renderStaticContent(content) {
  const paras = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    // numbered list items like "1. text" or "- text" → bullet
    if (/^[\d]+\./.test(t) || t.startsWith("-") || t.startsWith("•")) {
      paras.push(bulletItem(t.replace(/^[\d]+\.\s*/, "").replace(/^[-•]\s*/, "")));
    } else if (t.endsWith(":") && t.length < 80) {
      // Sub-heading style
      paras.push(new Paragraph({
        children: [new TextRun({ text: t, bold: true, size: 22, font: "Arial", color: "2E5496" })],
        spacing: { before: 120, after: 60 },
      }));
    } else {
      paras.push(bodyPara(t));
    }
  }
  return paras.filter(Boolean);
}

// ── Cover page ────────────────────────────────────────────────────────────────
function makeCoverPage(generatedAt) {
  return [
    new Paragraph({ children: [], spacing: { after: 2000 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "SPPU Knowledge Base", bold: true, size: 64, font: "Arial", color: "1F3864" })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Savitribai Phule Pune University", size: 36, font: "Arial", color: "2E5496" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Extracted for EduSite — PVPIT Project", size: 28, font: "Arial", color: "595959" })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Generated: ${new Date(generatedAt).toLocaleString("en-IN")}`, size: 22, font: "Arial", color: "888888", italics: true })],
      spacing: { after: 2000 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "www.unipune.ac.in", size: 24, font: "Arial", color: "2E5496" })],
    }),
    new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),
  ];
}

// ── Info table helper ─────────────────────────────────────────────────────────
function infoRow(label, value) {
  return new TableRow({
    children: [
      new TableCell({
        borders, width: { size: 2400, type: WidthType.DXA },
        shading: { fill: "EAF0FB", type: ShadingType.CLEAR },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial" })] })],
      }),
      new TableCell({
        borders, width: { size: 6560, type: WidthType.DXA },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: value || "—", size: 20, font: "Arial" })] })],
      }),
    ],
  });
}

// ── Build document ────────────────────────────────────────────────────────────
function buildDocument() {
  const children = [];

  // Cover
  children.push(...makeCoverPage(knowledge.generated_at));

  // ── PART 1: Static Knowledge ─────────────────────────────────────────────
  children.push(heading1("Part 1: SPPU Knowledge Base (Curated)"));
  children.push(bodyPara(
    "This section contains structured, verified information about SPPU processes, procedures, " +
    "scholarships, exam forms, timetables, and administrative services — compiled for the EduSite RAG system."
  ));
  children.push(divider());

  for (const item of knowledge.static_sections) {
    children.push(heading2(`${item.title}  [${categoryBadge(item.category)}]`));
    children.push(...renderStaticContent(item.content));
    children.push(divider());
  }

  // Page break before Part 2
  children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));

  // ── PART 2: Live Scraped Content ──────────────────────────────────────────
  children.push(heading1("Part 2: Live Data Scraped from SPPU Website"));

  const scraped = knowledge.scraped_pages || [];
  if (scraped.length === 0) {
    children.push(bodyPara(
      "No live pages were scraped (network may be unavailable). " +
      "Re-run sppu_scraper.py with internet access to populate this section."
    ));
  } else {
    children.push(bodyPara(
      `${scraped.length} pages were scraped from unipune.ac.in and affiliated portals. ` +
      `Content is extracted as-is from the live website.`
    ));
  }
  children.push(divider());

  for (const page of scraped) {
    children.push(heading2(`${page.label}  [${categoryBadge(page.category)}]`));

    // Source URL table
    children.push(new Table({
      width: { size: 8960, type: WidthType.DXA },
      columnWidths: [2400, 6560],
      rows: [
        infoRow("Source URL", page.url),
        infoRow("Category",   categoryBadge(page.category)),
        infoRow("Text blocks", String(page.line_count || 0)),
        infoRow("PDFs found", String(page.pdf_count || 0)),
      ],
    }));
    children.push(new Paragraph({ children: [], spacing: { after: 160 } }));

    // Page text
    if (page.page_text && page.page_text.trim()) {
      children.push(heading3("Extracted Website Content"));
      // split into meaningful lines
      const lines = page.page_text.split("\n").filter(l => l.trim().length > 20);
      for (const line of lines.slice(0, 300)) {  // cap at 300 lines per page
        const p = bodyPara(line.trim());
        if (p) children.push(p);
      }
      if (lines.length > 300) {
        children.push(bodyPara(`... [${lines.length - 300} more lines truncated — see sppu_knowledge.json for full data]`, { italics: true, color: "888888" }));
      }
    }

    // PDF sections
    if (page.pdf_sections && page.pdf_sections.length > 0) {
      children.push(heading3(`PDF Documents Extracted (${page.pdf_sections.length})`));
      for (const pdf of page.pdf_sections) {
        children.push(new Paragraph({
          children: [new TextRun({ text: `📄 ${pdf.title}`, bold: true, size: 22, font: "Arial", color: "2E5496" })],
          spacing: { before: 160, after: 80 },
        }));
        children.push(new Paragraph({
          children: [new TextRun({ text: `Source: ${pdf.url}`, size: 18, font: "Arial", color: "888888", italics: true })],
          spacing: { after: 100 },
        }));
        // PDF text — split into paragraphs
        const pdfLines = pdf.text.split(/[.!?]\s+/).filter(l => l.trim().length > 30);
        for (const line of pdfLines.slice(0, 100)) {
          const p = bodyPara(line.trim() + ".");
          if (p) children.push(p);
        }
        children.push(divider());
      }
    }

    children.push(divider());
  }

  // ── PART 3: Summary stats ─────────────────────────────────────────────────
  children.push(new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }));
  children.push(heading1("Part 3: Extraction Summary"));

  const totalChunks = (knowledge.rag_chunks || []).length;
  const totalPDFs   = scraped.reduce((acc, p) => acc + (p.pdf_count || 0), 0);

  children.push(new Table({
    width: { size: 8960, type: WidthType.DXA },
    columnWidths: [4480, 4480],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            shading: { fill: "1F3864", type: ShadingType.CLEAR },
            width: { size: 4480, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [new Paragraph({ children: [new TextRun({ text: "Metric", bold: true, size: 22, font: "Arial", color: "FFFFFF" })] })],
          }),
          new TableCell({
            borders,
            shading: { fill: "1F3864", type: ShadingType.CLEAR },
            width: { size: 4480, type: WidthType.DXA },
            margins: { top: 120, bottom: 120, left: 160, right: 160 },
            children: [new Paragraph({ children: [new TextRun({ text: "Value", bold: true, size: 22, font: "Arial", color: "FFFFFF" })] })],
          }),
        ],
      }),
      ...[
        ["Static knowledge entries",   String(knowledge.static_sections?.length || 0)],
        ["Live pages scraped",         String(scraped.length)],
        ["PDFs extracted",             String(totalPDFs)],
        ["Total RAG chunks",           String(totalChunks)],
        ["Generated at",               knowledge.generated_at || "—"],
        ["SPPU website",               "www.unipune.ac.in"],
      ].map(([label, value], i) =>
        new TableRow({
          children: [
            new TableCell({
              borders,
              shading: { fill: i % 2 === 0 ? "EAF0FB" : "FFFFFF", type: ShadingType.CLEAR },
              width: { size: 4480, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 160, right: 160 },
              children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial" })] })],
            }),
            new TableCell({
              borders,
              shading: { fill: i % 2 === 0 ? "EAF0FB" : "FFFFFF", type: ShadingType.CLEAR },
              width: { size: 4480, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 160, right: 160 },
              children: [new Paragraph({ children: [new TextRun({ text: value, size: 20, font: "Arial" })] })],
            }),
          ],
        })
      ),
    ],
  }));

  // ── Assemble document ─────────────────────────────────────────────────────
  return new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: "1F3864" },
          paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial", color: "2E5496" },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial", color: "375623" },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1260, bottom: 1440, left: 1260 },
        },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: "EduSite — PVPIT   |   SPPU Knowledge Base   |   Page ", size: 18, font: "Arial", color: "888888" }),
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: "888888" }),
                new TextRun({ text: " of ", size: 18, font: "Arial", color: "888888" }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: "888888" }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });
}

// ── Run ───────────────────────────────────────────────────────────────────────
(async () => {
  try {
    const doc    = buildDocument();
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(outPath, buffer);
    console.log(`Word document saved → ${outPath}`);
    console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
  } catch (err) {
    console.error("Error building Word doc:", err.message);
    process.exit(1);
  }
})();
