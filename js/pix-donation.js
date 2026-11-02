(function (global) {
  function field(id, value) {
    if (!/^\d{2}$/.test(id) || !/^[\x20-\x7E]+$/.test(value) || value.length > 99) {
      throw new Error('Os dados do pagamento Pix estão inválidos.');
    }
    return `${id}${String(value.length).padStart(2, '0')}${value}`;
  }

  function crc16(payload) {
    let crc = 0xffff;
    for (let index = 0; index < payload.length; index++) {
      crc ^= payload.charCodeAt(index) << 8;
      for (let bit = 0; bit < 8; bit++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  function buildPayload(amount, key, recipient, city) {
    const cents = Math.round(amount * 100);
    if (
      !Number.isFinite(amount) ||
      cents < 1 ||
      cents > 99999999 ||
      Math.abs(amount - cents / 100) > 0.000001 ||
      ! /^\+55\d{10,11}$/.test(key)) {
      throw new Error('Informe um valor válido e confira a chave Pix.');
    }

    const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', key);
    const additionalData = field('05', '***');
    const payload = field('00', '01') +
      field('01', '12') +
      field('26', merchantAccount) +
      field('52', '0000') +
      field('53', '986') +
      field('54', (cents / 100).toFixed(2)) +
      field('58', 'BR') +
      field('59', recipient) +
      field('60', city) +
      field('62', additionalData) +
      '6304';

    return `${payload}${crc16(payload)}`;
  }

  global.PixDonation = Object.freeze({ buildPayload });
})(window);
