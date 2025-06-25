const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'editinvest',
  description: 'Изменение статуса инвестиции пользователя (админ)',
  async execute(message, args, db, auditWebhook) {
    console.log(`!editinvest executed by ${message.author.id}`);

    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Только администраторы могут использовать эту команду',
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите пользователя через @',
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    const argsWithoutMention = args.filter(arg => !arg.startsWith('<@'));
    if (argsWithoutMention.length < 2) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите название инвестиции и статус (Неудачно, Удачно, Частично удачно)',
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    let status, purpose;
    const validStatuses = ['неудачно', 'удачно', 'частично удачно'];

    const lastTwoArgs = argsWithoutMention.slice(-2).join(' ').toLowerCase();
    if (lastTwoArgs === 'частично удачно') {
      status = 'частично удачно';
      purpose = argsWithoutMention.slice(0, -2).join(' ');
    } else {
      status = argsWithoutMention.slice(-1)[0].toLowerCase();
      purpose = argsWithoutMention.slice(0, -1).join(' ');
    }

    if (!validStatuses.includes(status)) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Статус должен быть: Неудачно, Удачно или Частично удачно',
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    if (!purpose) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите название инвестиции',
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    db.get('SELECT * FROM investments WHERE userId = ? AND purpose = ?', [targetUser.id, purpose], (err, investment) => {
      if (err) {
        console.error('Error fetching investment:', err);
        return message.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Ошибка при получении данных',
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
      }

      if (!investment) {
        return message.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Инвестиция "${purpose}" для ${targetUser.tag} не найдена`,
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
      }

      db.run('UPDATE investments SET status = ? WHERE userId = ? AND purpose = ?', [status, targetUser.id, purpose], (err) => {
        if (err) {
          console.error('Error updating investment status:', err);
          return message.reply({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при обновлении статуса',
              timestamp: new Date().toISOString(),
            }],
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x9b909e)
          .setTitle('Статус инвестиции обновлён')
          .setDescription(`Инвестиция "${purpose}" для ${targetUser.tag} теперь имеет статус: **${status}**`)
          .setTimestamp();

        message.reply({ embeds: [embed], ephemeral: true });

        auditWebhook.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Изменение статуса инвестиции',
            fields: [
              { name: 'Администратор', value: `<@${message.author.id}>`, inline: true },
              { name: 'Пользователь', value: `<@${targetUser.id}>`, inline: true },
              { name: 'Инвестиция', value: purpose, inline: true },
              { name: 'Новый статус', value: status, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        }).catch(console.error);

        console.log(`Investment status updated: user=${targetUser.id}, purpose=${purpose}, status=${status}`);
      });
    });
  },
};