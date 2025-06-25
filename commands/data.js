const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');

module.exports = {
  name: 'data',
  description: 'Показать текущую игровую дату',
  async execute(message, args, db) {
    const row = await new Promise((resolve, reject) => {
      db.get('SELECT value FROM settings WHERE key = ?', ['baseYear'], (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });
    const baseYear = row ? parseInt(row.value) : 1930;

    const now = moment().tz('Europe/Kiev'); 
    const hours = now.hours();
    const minutes = now.minutes();

    const totalMinutes = hours * 60 + minutes;
    const gameDay = Math.floor(totalMinutes / 8) % 30 + 1; 
    const months = [
      'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
      'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    const monthIndex = Math.floor((hours % 48) / 4);
    const monthName = months[monthIndex];
    const gameYear = baseYear + Math.floor((totalMinutes / 8) / 360);
    const gameDate = `${gameDay} ${monthName} ${gameYear}`;

    const embed = new EmbedBuilder()
      .setColor('#9B909E')
      .setTitle('Игровая дата')
      .setDescription(`Текущая игровая дата: **${gameDate}**`)
      .setFooter({ text: message.author.username })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};