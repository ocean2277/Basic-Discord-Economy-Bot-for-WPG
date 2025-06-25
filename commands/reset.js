const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'reset',
  description: 'Сбросить голосовое время пользователей',
  async execute(message, args, db, auditWebhook, constants = {}) {
    if (!message.member.roles.cache.has(config.adminRoleId)) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'У вас нет прав для выполнения этой команды',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    db.run('UPDATE users SET voiceTime = 0', (err) => {
      if (err) {
        console.error('Error resetting voiceTime:', err);
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Ошибка при сбросе голосового времени',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
      }

      message.channel.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Успех',
          description: 'Голосовое время всех пользователей сброшено',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });

      auditWebhook.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Сброс голосового времени',
          fields: [
            { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
          ],
          timestamp: new Date().toISOString(),
        }]
      }).catch(console.error);
    });
  },
};