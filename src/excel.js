// Builds an .xlsx file from the messages currently shown.
import { formatDay } from './share.js';
import { COMPANY } from './config.js';
import { saveFile } from './save.js';

export async function downloadExcel(messages, label, onPrompt) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY;
  const ws = wb.addWorksheet('ჟურნალი', { views: [{ state: 'frozen', ySplit: 1 }] });

  ws.columns = [
    { header: 'თარიღი', key: 'day', width: 12 },
    { header: 'დრო', key: 'time', width: 8 },
    { header: 'ავტორი', key: 'author', width: 20 },
    { header: 'ტექსტი', key: 'text', width: 60 },
    { header: 'ფოტო / ფაილი', key: 'files', width: 40 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.autoFilter = 'A1:E1';

  for (const m of messages) {
    if (m.system) continue;
    ws.addRow({
      day: formatDay(m.day),
      time: m.time.slice(0, 5),
      author: m.author,
      text: m.text,
      files: m.files.join(', '),
    });
  }
  ws.getColumn('text').alignment = { wrapText: true, vertical: 'top' };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  return saveFile(`მეკა-ჟურნალი-${label}.xlsx`, blob, onPrompt);
}
