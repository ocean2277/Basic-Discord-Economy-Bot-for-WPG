const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'case',
  description: 'Показать кейсы (предметы из второго магазина)',
  async execute(message, args, db, auditWebhook) {
    let targetUser = message.author;
    let targetUserId = targetUser.id;

    if (args[0] && message.mentions.users.size > 0) {
      targetUser = message.mentions.users.first();
      targetUserId = targetUser.id;
    }

    const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 128 });

    db.all('SELECT itemName, quantity FROM inventory WHERE userId = ? AND shopType = 2', [targetUserId], (err, rows) => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при получении акций')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const title = targetUserId === message.author.id ? 'Ваши акции' : `Акции ${targetUser.tag}`;
      if (!rows || rows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#9B909E')
          .setTitle('Акции')
          .setDescription(`${targetUserId === message.author.id ? 'Ваши акции пусты' : `У ${targetUser.tag} нет акций`}`)
          .setFooter({ text: message.author.username })
          .setThumbnail(avatarUrl)
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const items = rows.map((row) => `**${row.itemName}**: ${row.quantity} шт.`).join('\n');
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Акции')
        .setDescription(`${title}:\n${items}`)
        .setFooter({ text: message.author.username })
        .setThumbnail(avatarUrl)
        .setTimestamp();
      message.channel.send({ embeds: [embed] });

      if (auditWebhook) {
        const auditEmbed = {
          color: 0x9b909e,
          title: 'Просмотр акций',
          fields: [
            { name: 'Инициатор', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Цель', value: `${targetUser.tag} (${targetUserId})`, inline: true },
            { name: 'Предметы', value: items || 'Нет предметов', inline: false },
          ],
          timestamp: new Date().toISOString(),
        };
        auditWebhook.send({ embeds: [auditEmbed] }).catch((err) => console.error('Webhook error:', err));
      }
    });
  },
};