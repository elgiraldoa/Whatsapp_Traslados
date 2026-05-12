/**
 * Google Apps Script for WhatsApp Bot Integration
 * Versión: Desplegable con Estados y Colores
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // 1. Datos a insertar (Columna K: Estado inicial "Solicitado")
    var now = new Date();
    var dateOnly = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy");

    var rowData = [
      dateOnly,
      data.proyectoDestino,
      data.proyectoOrigen,
      data.material,
      data.cantidad,
      data.motivo,
      data.urgencia,
      data.fechaRequerida,
      data.responsable,
      data.usuarioWhatsApp,
      "Solicitado" // <--- Estado inicial
    ];

    // 2. Insertar la fila
    sheet.appendRow(rowData);
    var lastRow = sheet.getLastRow();
    var lastCol = rowData.length;
    var range = sheet.getRange(lastRow, 1, 1, lastCol);
    var statusCell = sheet.getRange(lastRow, lastCol);

    // 3. Aplicar Bordes
    range.setBorder(true, true, true, true, true, true, "#333333", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // 4. Crear el Desplegable (Dropdown)
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Solicitado', 'Aprobado', 'No aprobado'], true)
      .setAllowInvalid(false)
      .build();
    statusCell.setDataValidation(rule);

    // 5. Configurar Colores (Formato Condicional) para toda la columna K
    // Lo hacemos una sola vez o nos aseguramos de que existan las reglas
    applyConditionalFormatting(sheet, lastCol);

    return ContentService.createTextOutput(JSON.stringify({ "status": "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function applyConditionalFormatting(sheet, colIndex) {
  var range = sheet.getRange(2, colIndex, 1000, 1); // Rango de la columna K (desde la fila 2)

  // Limpiamos reglas previas para no duplicarlas
  var rules = sheet.getConditionalFormatRules();
  var newRules = [];

  // Definimos las reglas
  // Solicitado -> Azul clarito
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Solicitado')
    .setBackground('#cfe2f3')
    .setRanges([range])
    .build());

  // Aprobado -> Verde clarito
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Aprobado')
    .setBackground('#d9ead3')
    .setRanges([range])
    .build());

  // No aprobado -> Rojo clarito
  newRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('No aprobado')
    .setBackground('#f4cccc')
    .setRanges([range])
    .build());

  sheet.setConditionalFormatRules(newRules);
}
