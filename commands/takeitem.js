const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'takeitem',
  description: 'Забрать предмет у пользователя (только для админов)',
  async execute(message, args, db) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Нужны права администратора')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя и предмет: !takeitem @user item_name')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    const user = message.mentions.users.first();
    const itemName = args.slice(1).join(' ');

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.get('SELECT * FROM inventory WHERE userId = ? AND itemName = ?', [user.id, itemName], (err, item) => {
      if (err || !item) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('У пользователя нет этого предмета')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      db.run('DELETE FROM inventory WHERE userId = ? AND itemName = ?', [user.id, itemName], err => {
        if (err) {
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Ошибка при изъятии предмета')
            .setFooter({ text: message.author.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }
        const embed = new EmbedBuilder()
          .setColor('#9B909E')
          .setTitle('Изъятие предмета')
          .setDescription(`Забран ${itemName} у ${user.username}`)
          .setFooter({ text: message.author.username })
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      });
    });
  }
};