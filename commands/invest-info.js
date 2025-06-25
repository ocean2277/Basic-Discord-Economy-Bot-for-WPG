const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  name: 'invest-info',
  description: 'Просмотр инвестиций пользователя (админ)',
  async execute(message, args, db) {
    console.log(`!invest-info executed by ${message.author.id}`);

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

    db.all('SELECT * FROM investments WHERE userId = ?', [targetUser.id], (err, investments) => {
      if (err) {
        console.error('Error fetching investments:', err);
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

      if (!investments.length) {
        return message.reply({
          embeds: [{
            color: 0x9b909e,
            title: 'Инвестиции',
            description: `${targetUser.tag} не имеет инвестиций`,
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x9b909e)
        .setTitle(`Инвестиции ${targetUser.tag}`)
        .setTimestamp();

      investments.forEach((inv, index) => {
        embed.addFields({
          name: `Инвестиция #${index + 1}`,
          value: `**Цель**: ${inv.purpose}\n**Место**: ${inv.type === 'country' ? 'Страна' : inv.target}\n**Сумма**: ${inv.amount.toLocaleString()}\n**Срок**: ${inv.durationDays} дней\n**Статус**: ${inv.status}`,
          inline: false,
        });
      });

      message.reply({ embeds: [embed], ephemeral: true });
    });
  },
};