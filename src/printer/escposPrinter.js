// Sree Sai Fillings Cafe - Native ESC/POS Thermal Receipt Printer Driver
// Sends raw ESC/POS byte commands directly to Windows thermal receipt printers (POS-80, PeriPage, Epson, etc.)
// Ensures instant, pitch-black, razor-sharp printing with hardware font rendering and auto-cut.

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Format string to fixed width with padding
 */
function padRight(str, len) {
  str = (str || '') + '';
  if (str.length > len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}

function padLeft(str, len) {
  str = (str || '') + '';
  if (str.length > len) return str.substring(0, len);
  return ' '.repeat(len - str.length) + str;
}

/**
 * Word-wraps text into lines that do not exceed maxLen
 */
function wrapText(text, maxLen) {
  const words = (text || '').trim().split(/\s+/);
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if (!currentLine) {
      if (word.length > maxLen) {
        lines.push(word.substring(0, maxLen));
        currentLine = word.substring(maxLen);
      } else {
        currentLine = word;
      }
    } else if ((currentLine + ' ' + word).length <= maxLen) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      if (word.length > maxLen) {
        lines.push(word.substring(0, maxLen));
        currentLine = word.substring(maxLen);
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

function formatRow(col1, col2, col3, col4, totalWidth = 42) {
  // col1: Item name (20 chars)
  // col2: Qty (4 chars)
  // col3: Rate (8 chars)
  // col4: Total (10 chars)
  const c1 = padRight(col1, 20);
  const c2 = padLeft(col2, 4);
  const c3 = padLeft(col3, 8);
  const c4 = padLeft(col4, 10);
  return `${c1}${c2}${c3}${c4}`;
}

function formatKotRow(name, qty, totalWidth = 42) {
  const c1 = padRight(name, 32);
  const c2 = padLeft(qty, 10);
  return `${c1}${c2}`;
}

/**
 * 1. Build ESC/POS byte buffer for Customer Receipt Bill (with prices, totals & auto-cut)
 */
function buildCustomerBillEscposBytes(order) {
  const bytes = [];

  function addBytes(...arr) {
    bytes.push(...arr);
  }

  function addText(str) {
    const buf = Buffer.from(str, 'ascii');
    for (const b of buf) bytes.push(b);
  }

  // 1. Initialize Printer (ESC @)
  addBytes(0x1B, 0x40);

  // Center Align (ESC a 1)
  addBytes(0x1B, 0x61, 0x01);

  // Double Height + Double Width for Brand Name (GS ! 0x11)
  addBytes(0x1D, 0x21, 0x11);
  addBytes(0x1B, 0x45, 0x01); // Bold On
  addText("SREE SAI FILLINGS\n");

  // Normal Font (GS ! 0x00)
  addBytes(0x1D, 0x21, 0x00);
  addText("LIVE & XCLUSIVE EAT CLUB\n");
  addBytes(0x1B, 0x45, 0x00); // Bold Off
  addText("No 61/1, Sesi Avenue, Church Rd\n");
  addText("Cheran Ma Nagar, Coimbatore - 641035\n");
  addText("Phone: 82200 88119\n");
  addText("==========================================\n");

  // Left Align (ESC a 0)
  addBytes(0x1B, 0x61, 0x00);
  const orderNum = padRight(`Bill: ${order.order_number}`, 22);
  const orderDate = padLeft(`Date: ${order.order_date}`, 20);
  addText(`${orderNum}${orderDate}\n`);

  const orderTime = padRight(`Time: ${order.order_time}`, 22);
  const orderType = padLeft(`Type: ${(order.order_type || 'Dine-In').toUpperCase()}`, 20);
  addText(`${orderTime}${orderType}\n`);

  const custName = padRight(`Cust: ${order.customer_name || 'Walk-in'}`, 22);
  const payMode = padLeft(`Pay : ${order.payment_method || 'Cash'}`, 20);
  addText(`${custName}${payMode}\n`);

  if (order.customer_phone && order.customer_phone !== '0000000000') {
    addText(`Phone: ${order.customer_phone}\n`);
  }

  addText("------------------------------------------\n");

  // Column Headers (Bold)
  addBytes(0x1B, 0x45, 0x01); // Bold On
  addText(formatRow("ITEM", "QTY", "RATE", "TOTAL") + "\n");
  addBytes(0x1B, 0x45, 0x00); // Bold Off
  addText("------------------------------------------\n");

  // Items with multi-line word wrapping
  const items = order.items || [];
  for (const item of items) {
    const name = item.item_name || item.name || '';
    const qty = (item.quantity || 1) + '';
    const rate = parseFloat(item.unit_price || item.price || 0).toFixed(2);
    const total = parseFloat(item.total_price || item.total || 0).toFixed(2);

    const nameLines = wrapText(name, 20);
    // First line with item name part 1 + qty + rate + total
    addText(formatRow(nameLines[0], qty, rate, total) + "\n");
    // Subsequent lines for wrapped name
    for (let i = 1; i < nameLines.length; i++) {
      addText(padRight(nameLines[i], 20) + "\n");
    }
  }

  addText("------------------------------------------\n");

  // Calculations
  const subtotal = parseFloat(order.subtotal || 0).toFixed(2);
  addText(padRight("Subtotal:", 30) + padLeft(`Rs ${subtotal}`, 12) + "\n");

  const pkg = parseFloat(order.packaging_charge || 0);
  if (pkg > 0) {
    addText(padRight("Packaging (Takeaway):", 30) + padLeft(`+ Rs ${pkg.toFixed(2)}`, 12) + "\n");
  }

  const discount = parseFloat(order.discount || 0);
  if (discount > 0) {
    const discLabel = `Discount (${order.discount_type === 'percent' ? '%' : 'Flat'}):`;
    addText(padRight(discLabel, 30) + padLeft(`- Rs ${discount.toFixed(2)}`, 12) + "\n");
  }

  // Net Amount (Double Height + Bold)
  addBytes(0x1B, 0x45, 0x01); // Bold On
  addBytes(0x1D, 0x21, 0x01); // Double Height
  const finalTotal = parseFloat(order.final_total || 0).toFixed(2);
  addText(padRight("NET AMOUNT:", 24) + padLeft(`Rs ${finalTotal}`, 18) + "\n");

  addBytes(0x1D, 0x21, 0x00); // Normal Font
  addBytes(0x1B, 0x45, 0x00); // Bold Off
  addText("==========================================\n");

  // Footer (Center)
  addBytes(0x1B, 0x61, 0x01);
  addText("\"Made with Love\"\n");
  addText("Thank You For Visiting Sree Sai Fillings!\n");
  addText("Please Visit Again * Have A Great Day!\n\n");

  // Auto-Cut Bill 1 (GS V A 2 - clean cut with minimal paper feed)
  addBytes(0x1D, 0x56, 0x41, 0x02);

  return Buffer.from(bytes);
}

/**
 * 2. Build ESC/POS byte buffer for Kitchen Order Ticket / Chef Slip (no prices, bold items & auto-cut)
 */
function buildChefSlipEscposBytes(order, itemsToPrint = null, subtitle = null) {
  const bytes = [];

  function addBytes(...arr) {
    bytes.push(...arr);
  }

  function addText(str) {
    const buf = Buffer.from(str, 'ascii');
    for (const b of buf) bytes.push(b);
  }

  // Initialize for Ticket (ESC @)
  addBytes(0x1B, 0x40);

  // Center Align Header
  addBytes(0x1B, 0x61, 0x01);
  addBytes(0x1D, 0x21, 0x11); // Double Height & Width
  addBytes(0x1B, 0x45, 0x01); // Bold On
  addText("*** KITCHEN COPY ***\n");

  addBytes(0x1D, 0x21, 0x00); // Normal Font
  addText(subtitle ? `(${subtitle})\n` : "(KITCHEN ORDER TICKET)\n");
  addBytes(0x1B, 0x45, 0x00); // Bold Off
  addText("==========================================\n");

  addBytes(0x1B, 0x61, 0x00); // Left Align

  const kotNum = padRight(`KOT No : ${order.order_number}`, 22);
  const kotTime = padLeft(`Time: ${order.order_time || ''}`, 20);
  addText(`${kotNum}${kotTime}\n`);

  const kotType = padRight(`Type   : ${(order.order_type || 'Dine-In').toUpperCase()}`, 22);
  const kotDate = padLeft(`Date: ${order.order_date || ''}`, 20);
  addText(`${kotType}${kotDate}\n`);

  addBytes(0x1B, 0x45, 0x01); // Bold On
  addText(`Customer: ${order.customer_name || 'Walk-in'}\n`);
  addBytes(0x1B, 0x45, 0x00);

  if (order.notes) {
    addText(`Special Note: ${order.notes}\n`);
  }

  addText("------------------------------------------\n");
  addBytes(0x1B, 0x45, 0x01);
  addText(formatKotRow("ORDER ITEM", "QTY") + "\n");
  addBytes(0x1B, 0x45, 0x00);
  addText("------------------------------------------\n");

  const items = itemsToPrint && itemsToPrint.length > 0 ? itemsToPrint : (order.items || []);
  for (const item of items) {
    const name = item.item_name || item.name || '';
    const qty = `x ${item.quantity || 1}`;

    const nameLines = wrapText(name, 30);
    addBytes(0x1B, 0x45, 0x01); // Bold item name
    addText(formatKotRow(nameLines[0], qty) + "\n");
    for (let i = 1; i < nameLines.length; i++) {
      addText(padRight(nameLines[i], 30) + "\n");
    }
    addBytes(0x1B, 0x45, 0x00);
  }

  addText("------------------------------------------\n");
  addBytes(0x1B, 0x61, 0x01); // Center Align
  addText("*** PREPARE FRESH & HOT ***\n\n");

  // Auto-Cut Bill 2 (GS V A 2 - clean cut with minimal paper feed)
  addBytes(0x1D, 0x56, 0x41, 0x02);

  return Buffer.from(bytes);
}

/**
 * 3. Build Dual Bill ESC/POS buffer (1 Customer Bill + Cut + 1 Kitchen KOT + Cut)
 * Exactly 1 Bill and 1 KOT are printed with individual hardware auto-cuts.
 */
function buildDualBillEscposBytes(order, itemsToPrint = null, subtitle = null) {
  const customerBuf = buildCustomerBillEscposBytes(order);
  const chefBuf = buildChefSlipEscposBytes(order, itemsToPrint, subtitle);
  return Buffer.concat([customerBuf, chefBuf]);
}

/**
 * Locate precompiled RawPrint.exe native helper
 */
function getRawPrintExePath() {
  const possiblePaths = [
    path.join(__dirname, 'RawPrint.exe'),
    path.join(__dirname, 'RawPrint.exe').replace('app.asar', 'app.asar.unpacked'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'src', 'printer', 'RawPrint.exe'),
    path.join(process.cwd(), 'src', 'printer', 'RawPrint.exe')
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Send raw ESC/POS bytes to Windows printer using native winspool RawPrint.exe
 * Instant execution (< 30ms), no PowerShell compile delay, no timeouts.
 */
function sendRawEscposToPrinter(printerName, buffer) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve({ success: false, message: 'RAW printing is only supported on Windows' });
    }

    const tempBinPath = path.join(process.env.TEMP || '.', `receipt_${Date.now()}.bin`);
    fs.writeFileSync(tempBinPath, buffer);

    // 1. Try native pre-compiled RawPrint.exe (Instant ~20ms, pitch-black hardware rendering)
    const rawExe = getRawPrintExePath();
    if (rawExe) {
      execFile(rawExe, [printerName, tempBinPath], { timeout: 4000, windowsHide: true }, (err, stdout, stderr) => {
        try { fs.unlinkSync(tempBinPath); } catch (e) {}
        if (err || (stdout && stdout.includes('FAILED'))) {
          console.warn('RawPrint.exe returned failure:', err ? err.message : stdout);
          return resolve({ success: false, message: stdout || (err && err.message) });
        }
        const success = stdout && stdout.includes('SUCCESS');
        resolve({ success: true, message: success ? '' : 'Failed to write RAW stream to printer spooler' });
      });
      return;
    }

    // 2. Fallback to PowerShell if RawPrint.exe is unavailable
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes)
    {
        Int32 dwCount = pBytes.Length;
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(dwCount);
        Marshal.Copy(pBytes, 0, pUnmanagedBytes, dwCount);
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Fillings Receipt RAW";
        di.pDataType = "RAW";
        bool bSuccess = false;

        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    Int32 dwWritten = 0;
                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, dwCount, out dwWritten);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        return bSuccess;
    }
}
"@
$bytes = [System.IO.File]::ReadAllBytes("${tempBinPath.replace(/\\/g, '\\\\')}")
$res = [RawPrinterHelper]::SendBytesToPrinter("${printerName.replace(/"/g, '`"')}", $bytes)
Write-Output "RESULT:$res"
`;

    let isResolved = false;
    const safetyTimer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        try { fs.unlinkSync(tempBinPath); } catch (e) {}
        console.warn('sendRawEscposToPrinter timed out after 3500ms');
        resolve({ success: false, message: 'Printer spooler timed out' });
      }
    }, 3500);

    execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy', 'Bypass',
      '-Command', psScript
    ], { timeout: 3000, windowsHide: true }, (err, stdout, stderr) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(safetyTimer);
      try { fs.unlinkSync(tempBinPath); } catch (e) {}

      if (err) {
        console.warn('sendRawEscposToPrinter error:', err.message);
        return resolve({ success: false, message: err.message });
      }

      const success = stdout && stdout.includes('RESULT:True');
      resolve({ success, message: success ? '' : 'Failed to write RAW stream to printer spooler' });
    });
  });
}

/**
 * Print an order directly using ESC/POS
 * @param {string} printerName - Target Windows printer name (e.g. 'POS-80')
 * @param {object} order - Order object with items, customer details, totals
 * @param {string} [view='both'] - 'both' (2 cut bills), 'customer' (customer bill only), or 'chef' (KOT only)
 * @param {object} [options={}] - Additional options { itemsToPrint, subtitle }
 */
async function printOrderEscpos(printerName, order, view = 'both', options = {}) {
  try {
    let buffer;
    if (view === 'customer') {
      buffer = buildCustomerBillEscposBytes(order);
    } else if (view === 'chef') {
      buffer = buildChefSlipEscposBytes(order, options.itemsToPrint, options.subtitle);
    } else {
      buffer = buildDualBillEscposBytes(order, options.itemsToPrint, options.subtitle);
    }
    return await sendRawEscposToPrinter(printerName, buffer);
  } catch (err) {
    console.error('printOrderEscpos error:', err);
    return { success: false, message: err.message };
  }
}

module.exports = {
  wrapText,
  buildCustomerBillEscposBytes,
  buildChefSlipEscposBytes,
  buildDualBillEscposBytes,
  sendRawEscposToPrinter,
  printOrderEscpos
};
