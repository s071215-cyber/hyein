// official-docs/app.js
// 브라우저에서만 동작하는 순수 클라이언트 스크립트예요. 서버 없이
// window.docx (docx 라이브러리), window.XLSX (SheetJS), window.JSZip 을 사용해서
// 표준 행정기관 공문서(docx)를 생성해요.

(() => {
  "use strict";

  const FONT = "맑은 고딕";

  // 폼/엑셀 공통으로 쓰는 필드 정의예요. key는 엑셀 헤더명과도 그대로 맞춰요.
  const FIELDS = [
    { key: "기관명", label: "기관명 (발신 기관)", type: "text", required: true, placeholder: "예: 서울특별시 OO구청" },
    { key: "수신", label: "수신", type: "text", required: true, placeholder: "예: OOO 귀하 / 관계 기관장" },
    { key: "경유", label: "경유", type: "text", required: false, placeholder: "해당 없으면 비워두세요" },
    { key: "제목", label: "제목", type: "text", required: true, placeholder: "공문 제목" },
    { key: "본문", label: "본문", type: "textarea", required: true, placeholder: "1. 관련: ...\n2. ...", hint: "줄바꿈으로 문단을 나눠요. 필요하면 '1.', '가.' 등 번호를 직접 붙여주세요." },
    { key: "붙임", label: "붙임 (첨부)", type: "textarea", required: false, placeholder: "1. 붙임자료명 1부.", hint: "없으면 비워두세요. 여러 개면 줄바꿈으로 구분해요." },
    { key: "발신명의", label: "발신명의", type: "text", required: true, placeholder: "예: OO구청장" },
    { key: "문서번호", label: "문서번호", type: "text", required: false, placeholder: "예: 총무과-1234" },
    { key: "시행일자", label: "시행일자", type: "text", required: false, placeholder: "예: 2026.8.27." },
    { key: "우편번호", label: "우편번호", type: "text", required: false, placeholder: "예: 12345" },
    { key: "주소", label: "주소", type: "text", required: false, placeholder: "예: 서울특별시 OO구 OO로 100" },
    { key: "전화번호", label: "전화번호", type: "text", required: false, placeholder: "예: 02-1234-5678" },
    { key: "팩스번호", label: "팩스번호", type: "text", required: false, placeholder: "예: 02-1234-5679" },
    { key: "이메일", label: "이메일", type: "text", required: false, placeholder: "예: dept@agency.go.kr" },
    { key: "공개구분", label: "공개구분", type: "select", options: ["공개", "부분공개", "비공개"], required: false },
  ];

  function nonEmptyLines(text) {
    return String(text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- docx(Word) 생성 ----------

  function textParagraph(docx, text, opts = {}) {
    const { BorderStyle, AlignmentType, TextRun, Paragraph } = docx;
    const { bold, size = 21, align, indent, spacingBefore, spacingAfter, borderTop, borderBottom } = opts;
    const p = {
      alignment: align,
      indent: indent ? { left: indent } : undefined,
      spacing: { before: spacingBefore || 0, after: spacingAfter || 0, line: 300 },
      children: [new TextRun({ text, bold, size, font: FONT })],
    };
    if (borderTop || borderBottom) {
      p.border = {};
      if (borderTop) p.border.top = { style: BorderStyle.SINGLE, size: 8, color: "222222" };
      if (borderBottom) p.border.bottom = { style: BorderStyle.SINGLE, size: 8, color: "222222" };
    }
    return new Paragraph(p);
  }

  function buildDocxDocument(data) {
    const docx = window.docx;
    const { Document, AlignmentType } = docx;
    const children = [];

    children.push(
      textParagraph(docx, data.기관명 || "", {
        bold: true, size: 44, align: AlignmentType.CENTER, spacingAfter: 200, borderBottom: true,
      })
    );

    let receiveLine = `수신  ${data.수신 || ""}`;
    if (data.경유) receiveLine += `   (경유  ${data.경유})`;
    children.push(textParagraph(docx, receiveLine, { size: 22, spacingBefore: 240 }));

    children.push(
      textParagraph(docx, `제목  ${data.제목 || ""}`, { bold: true, size: 24, spacingBefore: 240, spacingAfter: 240 })
    );

    const bodyLines = nonEmptyLines(data.본문);
    const attachLines = nonEmptyLines(data.붙임);
    const tailIsAttach = attachLines.length > 0;

    bodyLines.forEach((line, i) => {
      const isLast = !tailIsAttach && i === bodyLines.length - 1;
      const text = isLast ? `${line}  끝.` : line;
      children.push(textParagraph(docx, text, { size: 22, indent: 432, spacingAfter: 40 }));
    });

    if (attachLines.length > 0) {
      children.push(textParagraph(docx, " ", { size: 22 }));
      attachLines.forEach((line, i) => {
        const prefix = i === 0 ? "붙임  " : "        ";
        const isLast = i === attachLines.length - 1;
        const text = `${prefix}${line}` + (isLast ? "  끝." : "");
        children.push(textParagraph(docx, text, { size: 22, spacingAfter: 40 }));
      });
    }

    children.push(textParagraph(docx, " ", { size: 22 }));
    children.push(textParagraph(docx, " ", { size: 22 }));
    children.push(
      textParagraph(docx, data.발신명의 || "", {
        bold: true, size: 32, align: AlignmentType.CENTER, spacingBefore: 200, spacingAfter: 400,
      })
    );

    const footer1 = data.문서번호
      ? `시행  ${data.문서번호}${data.시행일자 ? `(${data.시행일자})` : ""}`
      : "";
    const footer2 = [data.우편번호 ? `우 ${data.우편번호}` : null, data.주소 || null].filter(Boolean).join("   ");
    const footer3 = [
      data.전화번호 ? `전화번호(${data.전화번호})` : null,
      data.팩스번호 ? `팩스번호(${data.팩스번호})` : null,
      data.이메일 || null,
      data.공개구분 ? `공개구분: ${data.공개구분}` : null,
    ].filter(Boolean).join("   /   ");

    if (footer1) children.push(textParagraph(docx, footer1, { size: 16, borderTop: true, spacingBefore: 120 }));
    if (footer2) children.push(textParagraph(docx, footer2, { size: 16 }));
    if (footer3) children.push(textParagraph(docx, footer3, { size: 16 }));

    return new Document({
      sections: [
        { properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children },
      ],
    });
  }

  async function buildDocxBlob(data) {
    const doc = buildDocxDocument(data);
    return window.docx.Packer.toBlob(doc);
  }

  // ---------- 화면 미리보기(HTML) ----------

  function renderPreviewHtml(data) {
    const bodyLines = nonEmptyLines(data.본문);
    const attachLines = nonEmptyLines(data.붙임);
    const tailIsAttach = attachLines.length > 0;

    const bodyHtml = bodyLines
      .map((line, i) => {
        const isLast = !tailIsAttach && i === bodyLines.length - 1;
        return `<p class="doc-p">${escapeHtml(line)}${isLast ? "&nbsp;&nbsp;끝." : ""}</p>`;
      })
      .join("");

    const attachHtml = attachLines.length
      ? `<p class="doc-p">&nbsp;</p>` +
        attachLines
          .map((line, i) => {
            const prefix = i === 0 ? "붙임&nbsp;&nbsp;" : "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;";
            const isLast = i === attachLines.length - 1;
            return `<p class="doc-p">${prefix}${escapeHtml(line)}${isLast ? "&nbsp;&nbsp;끝." : ""}</p>`;
          })
          .join("")
      : "";

    const footer1 = data.문서번호 ? `시행  ${escapeHtml(data.문서번호)}${data.시행일자 ? `(${escapeHtml(data.시행일자)})` : ""}` : "";
    const footer2 = [data.우편번호 ? `우 ${escapeHtml(data.우편번호)}` : null, data.주소 ? escapeHtml(data.주소) : null]
      .filter(Boolean).join("&nbsp;&nbsp;&nbsp;");
    const footer3 = [
      data.전화번호 ? `전화번호(${escapeHtml(data.전화번호)})` : null,
      data.팩스번호 ? `팩스번호(${escapeHtml(data.팩스번호)})` : null,
      data.이메일 ? escapeHtml(data.이메일) : null,
      data.공개구분 ? `공개구분: ${escapeHtml(data.공개구분)}` : null,
    ].filter(Boolean).join("&nbsp;&nbsp;/&nbsp;&nbsp;");

    return `
      <div class="doc-org">${escapeHtml(data.기관명 || "")}</div>
      <div class="doc-line">수신&nbsp;&nbsp;${escapeHtml(data.수신 || "")}${data.경유 ? `&nbsp;&nbsp;&nbsp;(경유&nbsp;&nbsp;${escapeHtml(data.경유)})` : ""}</div>
      <div class="doc-title">제목&nbsp;&nbsp;${escapeHtml(data.제목 || "")}</div>
      <div class="doc-body">${bodyHtml}${attachHtml}</div>
      <div class="doc-issuer">${escapeHtml(data.발신명의 || "")}</div>
      <div class="doc-footer">
        ${footer1 ? `<div>${footer1}</div>` : ""}
        ${footer2 ? `<div>${footer2}</div>` : ""}
        ${footer3 ? `<div>${footer3}</div>` : ""}
      </div>
    `;
  }

  // ---------- 파일 다운로드 유틸 ----------

  function sanitizeFilename(name) {
    return String(name || "공문서").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80) || "공문서";
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- 엑셀 양식 다운로드 ----------

  function downloadExcelTemplate() {
    const headers = FIELDS.map((f) => f.key);
    const sample = FIELDS.map((f) => {
      if (f.key === "본문") return "1. 관련: OOO.\n2. 위와 관련하여 아래와 같이 알려드립니다.";
      if (f.key === "공개구분") return "공개";
      return "";
    });
    const ws = window.XLSX.utils.aoa_to_sheet([headers, sample]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "공문서목록");
    window.XLSX.writeFile(wb, "공문서_일괄생성_양식.xlsx");
  }

  // ---------- 엑셀 일괄 생성 ----------

  async function generateFromExcelFile(file, onProgress) {
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (rows.length === 0) throw new Error("엑셀에 데이터 행이 없어요.");

    const zip = new window.JSZip();
    const usedNames = new Map();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const data = {};
      FIELDS.forEach((f) => { data[f.key] = row[f.key] != null ? String(row[f.key]) : ""; });

      if (!data.제목 && !data.본문) continue; // 빈 행은 건너뛰어요

      const blob = await buildDocxBlob(data);
      let base = sanitizeFilename(data.제목 || `공문서_${i + 1}`);
      const count = usedNames.get(base) || 0;
      usedNames.set(base, count + 1);
      const name = count === 0 ? `${base}.docx` : `${base}_${count + 1}.docx`;

      zip.file(name, blob);
      if (onProgress) onProgress(i + 1, rows.length, data.제목 || base);
    }

    return zip.generateAsync({ type: "blob" });
  }

  // 다른 스크립트(index.html 내 인라인 스크립트)에서 쓸 수 있게 전역에 노출해요.
  window.OfficialDocs = {
    FIELDS,
    buildDocxBlob,
    renderPreviewHtml,
    downloadBlob,
    downloadExcelTemplate,
    generateFromExcelFile,
    sanitizeFilename,
  };
})();
