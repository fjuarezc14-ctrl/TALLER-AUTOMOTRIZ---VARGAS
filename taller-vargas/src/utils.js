// src/utils.js - Utilidades globales compartidas ERP Taller Vargas

export function safeFormatDate(dateVal, options) {
  if (options === undefined) options = { day: '2-digit', month: 'short', year: 'numeric' };
  if (!dateVal) return '—';
  var parsedDate;
  if (typeof dateVal === 'string') {
    parsedDate = dateVal.includes('T') ? new Date(dateVal) : new Date(dateVal + 'T12:00:00');
  } else {
    parsedDate = new Date(dateVal);
  }
  if (isNaN(parsedDate.getTime())) return '—';
  return parsedDate.toLocaleDateString('es-PE', options);
}

export function safeFormatDateTime(dateVal) {
  if (!dateVal) return '—';
  var parsedDate;
  if (typeof dateVal === 'string') {
    parsedDate = dateVal.includes('T') ? new Date(dateVal) : new Date(dateVal + 'T12:00:00');
  } else {
    parsedDate = new Date(dateVal);
  }
  if (isNaN(parsedDate.getTime())) return '—';
  var dateStr = parsedDate.toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
  var timeStr = parsedDate.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
  return dateStr + ' ' + timeStr;
}

export function debounce(fn, ms) {
  if (ms === undefined) ms = 300;
  var timer;
  return function() {
    var args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function() { fn.apply(null, args); }, ms);
  };
}

export function formatCurrency(value) {
  var num = parseFloat(value) || 0;
  return 'S/ ' + num.toFixed(2);
}
