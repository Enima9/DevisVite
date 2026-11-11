/**
 * Fabrique un PDF « Factur-X » : on prend un PDF déjà généré et on lui AJOUTE (mise à jour incrémentale,
 * sans toucher aux octets d'origine) : le fichier factur-x.xml en pièce jointe (AFRelationship /Data),
 * les métadonnées XMP PDF/A-3 + extension Factur-X, un profil colorimétrique sRGB (OutputIntent).
 *
 * Aucune dépendance externe. Limite connue : on ne gère que les PDF à table de références classique
 * (ce que produit @react-pdf/renderer) ; sinon une erreur explicite est levée.
 */
import { createHash } from 'node:crypto';
import { SRGB_ICC_BASE64 } from './srgb-icc';

export interface EmbedOptions {
  xml: string;
  title: string;
  author: string;
  created: Date;
  /** Niveau de conformité Factur-X déclaré dans le XMP. */
  conformanceLevel?: string; // « EN 16931 » par défaut
  documentType?: 'INVOICE' | 'CREDITNOTE';
}

const pdfDate = (d: Date) => `D:${d.toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`;
const pdfString = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Lit un dictionnaire PDF à partir de `start` (qui pointe sur « << »), en gérant l'imbrication et les chaînes. */
function readDict(s: string, start: number): { text: string; end: number } {
  let depth = 0;
  let i = start;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') {
      let nest = 1;
      i++;
      while (i < s.length && nest > 0) {
        if (s[i] === '\\') i += 2;
        else {
          if (s[i] === '(') nest++;
          else if (s[i] === ')') nest--;
          i++;
        }
      }
      continue;
    }
    if (c === '<' && s[i + 1] === '<') {
      depth++;
      i += 2;
      continue;
    }
    if (c === '>' && s[i + 1] === '>') {
      depth--;
      i += 2;
      if (depth === 0) return { text: s.slice(start, i), end: i };
      continue;
    }
    if (c === '<') {
      const close = s.indexOf('>', i);
      if (close < 0) break;
      i = close + 1;
      continue;
    }
    i++;
  }
  throw new Error('PDF illisible : dictionnaire non terminé');
}

function buildXmp(o: EmbedOptions): string {
  const level = o.conformanceLevel ?? 'EN 16931';
  const type = o.documentType ?? 'INVOICE';
  const created = o.created.toISOString();
  const prop = (name: string, desc: string) =>
    `<rdf:li rdf:parseType="Resource"><pdfaProperty:name>${name}</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>${desc}</pdfaProperty:description></rdf:li>`;
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">` +
    `<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
    `<dc:title><rdf:Alt><rdf:li xml:lang="x-default">${xmlEsc(o.title)}</rdf:li></rdf:Alt></dc:title>` +
    `<dc:creator><rdf:Seq><rdf:li>${xmlEsc(o.author)}</rdf:li></rdf:Seq></dc:creator></rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>DevisVite</pdf:Producer></rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>DevisVite</xmp:CreatorTool><xmp:CreateDate>${created}</xmp:CreateDate><xmp:ModifyDate>${created}</xmp:ModifyDate></rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CIIXML:1p0#"><fx:DocumentType>${type}</fx:DocumentType><fx:DocumentFileName>factur-x.xml</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>${level}</fx:ConformanceLevel></rdf:Description>` +
    `<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">` +
    `<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>` +
    `<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CIIXML:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix>` +
    `<pdfaSchema:property><rdf:Seq>` +
    prop('DocumentFileName', 'name of the embedded XML invoice file') +
    prop('DocumentType', 'INVOICE') +
    prop('Version', 'The actual version of the Factur-X XML schema') +
    prop('ConformanceLevel', 'The conformance level of the embedded Factur-X data') +
    `</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>` +
    `</rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>`
  );
}

export function embedFacturX(pdf: Uint8Array, opts: EmbedOptions): Uint8Array {
  const original = Buffer.from(pdf);
  // PDF/A-3 repose sur PDF 1.7 : on relève l'en-tête (même longueur, aucun décalage d'octets).
  if (/^%PDF-1\.[0-6]/.test(original.subarray(0, 8).toString('latin1'))) original.write('%PDF-1.7', 0, 'latin1');
  const text = original.toString('latin1');

  // 1. startxref + trailer de l'original
  const sx = text.match(/startxref\s+(\d+)\s+%%EOF\s*$/);
  if (!sx) throw new Error('PDF non reconnu : startxref introuvable');
  const prevXref = Number(sx[1]);
  const tailStart = Math.max(0, text.length - 4096);
  const tail = text.slice(tailStart);
  const tr = tail.match(/trailer\s*(<<[\s\S]*>>)\s*startxref/);
  if (!tr) throw new Error('PDF non pris en charge : pas de trailer classique (table de références compressée)');
  const trailer = tr[1];
  const size = Number((trailer.match(/\/Size\s+(\d+)/) ?? [])[1]);
  const rootM = trailer.match(/\/Root\s+(\d+)\s+(\d+)\s+R/);
  if (!size || !rootM) throw new Error('PDF non reconnu : /Size ou /Root manquant');
  const rootNum = Number(rootM[1]);
  const infoM = trailer.match(/\/Info\s+\d+\s+\d+\s+R/);
  let idStr = (trailer.match(/\/ID\s*\[[^\]]*\]/) ?? [])[0];
  if (!idStr) {
    const h = createHash('md5').update(original).digest('hex');
    idStr = `/ID [<${h}> <${h}>]`;
  }

  // 2. Catalogue d'origine
  const objRe = new RegExp(`(?:^|[\\r\\n])${rootNum}\\s+0\\s+obj\\s*`, 'g');
  let objStart = -1;
  let m: RegExpExecArray | null;
  while ((m = objRe.exec(text))) objStart = m.index + m[0].length;
  if (objStart < 0 || text.slice(objStart, objStart + 2) !== '<<') throw new Error('Catalogue PDF introuvable');
  const root = readDict(text, objStart).text;
  let body = root.slice(2, -2);
  if (/\/Names\b/.test(body) || /\/AF\b/.test(body)) {
    throw new Error('Catalogue PDF déjà muni de /Names ou /AF : cas non pris en charge');
  }
  body = body.replace(/\/Metadata\s+\d+\s+\d+\s+R/, '');
  const hasOutputIntents = /\/OutputIntents\b/.test(body);

  // 3. Nouveaux objets
  const xmlBytes = Buffer.from(opts.xml, 'utf8');
  const xmpBytes = Buffer.from(buildXmp(opts), 'utf8');
  const iccBytes = Buffer.from(SRGB_ICC_BASE64, 'base64');
  const nFile = size;
  const nSpec = size + 1;
  const nMeta = size + 2;
  const nIcc = size + 3;
  const newSize = size + 4;
  const modDate = pdfDate(opts.created);

  const stream = (num: number, dict: string, data: Buffer) =>
    Buffer.concat([
      Buffer.from(`${num} 0 obj\n<< ${dict} /Length ${data.length} >>\nstream\n`, 'latin1'),
      data,
      Buffer.from(`\nendstream\nendobj\n`, 'latin1'),
    ]);

  const objects: { num: number; data: Buffer }[] = [
    {
      num: nFile,
      data: stream(nFile, `/Type /EmbeddedFile /Subtype /text#2Fxml /Params << /Size ${xmlBytes.length} /ModDate ${pdfString(modDate)} >>`, xmlBytes),
    },
    {
      num: nSpec,
      data: Buffer.from(
        `${nSpec} 0 obj\n<< /Type /Filespec /F (factur-x.xml) /UF (factur-x.xml) /Desc (Factur-X Invoice) /AFRelationship /Data /EF << /F ${nFile} 0 R /UF ${nFile} 0 R >> >>\nendobj\n`,
        'latin1'
      ),
    },
    { num: nMeta, data: stream(nMeta, '/Type /Metadata /Subtype /XML', xmpBytes) },
    { num: nIcc, data: stream(nIcc, '/N 3 /Alternate /DeviceRGB', iccBytes) },
  ];

  const newRoot =
    `${rootNum} 0 obj\n<<${body.replace(/\s+$/, '')}\n` +
    `/Metadata ${nMeta} 0 R\n` +
    `/Names << /EmbeddedFiles << /Names [(factur-x.xml) ${nSpec} 0 R] >> >>\n` +
    `/AF [${nSpec} 0 R]\n` +
    (hasOutputIntents
      ? ''
      : `/OutputIntents [<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /Info (sRGB IEC61966-2.1) /RegistryName (http://www.color.org) /DestOutputProfile ${nIcc} 0 R >>]\n`) +
    `>>\nendobj\n`;

  // 4. Assemblage : original + \n + objets + xref + trailer
  const parts: Buffer[] = [original, Buffer.from('\n', 'latin1')];
  let offset = original.length + 1;
  const offsets = new Map<number, number>();
  for (const o of objects) {
    offsets.set(o.num, offset);
    parts.push(o.data);
    offset += o.data.length;
  }
  const rootBuf = Buffer.from(newRoot, 'latin1');
  offsets.set(rootNum, offset);
  parts.push(rootBuf);
  offset += rootBuf.length;

  const xrefOffset = offset;
  const entry = (off: number) => `${String(off).padStart(10, '0')} 00000 n \n`;
  const nums = [...offsets.keys()].sort((a, b) => a - b);
  let xref = 'xref\n';
  let i = 0;
  while (i < nums.length) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    xref += `${nums[i]} ${j - i + 1}\n`;
    for (let k = i; k <= j; k++) xref += entry(offsets.get(nums[k])!);
    i = j + 1;
  }
  xref +=
    `trailer\n<< /Size ${newSize} /Root ${rootNum} 0 R ${infoM ? infoM[0] : ''} ${idStr} /Prev ${prevXref} >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, 'latin1'));

  return new Uint8Array(Buffer.concat(parts));
}
