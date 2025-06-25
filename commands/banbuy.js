const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'banbuy',
  description: 'Запретить или разрешить пользователю покупать предметы',
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

    if (args.length < 2 || !['ban', 'unban'].includes(args[0].toLowerCase())) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Использование: ```!banbuy <ban|unban> <@пользователь>```\nПример: ```!banbuy ban @user```',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const action = args[0].toLowerCase();
    const user = message.mentions.users.first();
    if (!user) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите пользователя через @',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const userId = user.id;

    if (action === 'ban') {
      db.run('INSERT OR REPLACE INTO buy_bans (userId, isBanned) VALUES (?, 1)', [userId], (err) => {
        if (err) {
          console.error('Error banning user:', err);
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при установке запрета',
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }

        message.channel.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Успех',
            description: `Пользователю ${user.tag} запрещено покупать предметы`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });

        auditWebhook.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Запрет покупки',
            fields: [
              { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Пользователь', value: `${user.tag} (${userId})`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }]
        }).catch(console.error);
      });
    } else {
      db.run('DELETE FROM buy_bans WHERE userId = ?', [userId], (err) => {
        if (err) {
          console.error('Error unbanning user:', err);
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при снятии запрета',
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }

        message.channel.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Успех',
            description: `Пользователю ${user.tag} разрешено покупать предметы`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });

        auditWebhook.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Снятие запрета покупки',
            fields: [
              { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Пользователь', value: `${user.tag} (${userId})`, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        }).catch(console.error);
      });
    }
  },
};