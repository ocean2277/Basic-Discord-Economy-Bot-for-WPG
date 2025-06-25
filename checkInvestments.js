const sqlite3 = require('sqlite3').verbose();
const { Client, EmbedBuilder } = require('discord.js');
const config = require('./config.json');

module.exports = (client) => {
  const db = new sqlite3.Database('./economy.db', (err) => {
    if (err) console.error('DB connection error:', err);
    else console.log('Connected to economy.db for investments');
  });

  setInterval(() => {
    const now = Date.now();
    db.all('SELECT * FROM investments WHERE status = ? AND startDate + (durationDays * 86400000) <= ?', ['pending', now], async (err, investments) => {
      if (err) {
        console.error('Error checking investments:', err);
        return;
      }

      const channel = await client.channels.fetch(config.investmentResultChannelId).catch(err => {
        console.error('Error fetching investment channel:', err);
        return null;
      });

      if (!channel) return;

      for (const inv of investments) {
        const user = await client.users.fetch(inv.userId).catch(() => null);
        if (!user) continue;

        await channel.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Рассмотрение инвестиции',
            fields: [
              { name: 'Пользователь', value: `${user.tag} (${inv.userId})`, inline: true },
              { name: 'Тип', value: inv.type === 'country' ? 'Страна' : 'Территория', inline: true },
              { name: 'Цель', value: inv.purpose, inline: true },
              { name: 'Место', value: inv.target, inline: true },
              { name: 'Сумма', value: `${inv.amount.toLocaleString()} ${config.cur}`, inline: true },
              { name: 'Срок', value: `${inv.durationDays} дней`, inline: true },
            ],
            footer: { text: 'Ожидает решения администратора' },
            timestamp: new Date().toISOString(),
          }],
        });
      }
    });
  }, 3600000); 
};