const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'use',
  description: 'Использовать предмет',
  async execute(message, args, db) {
    if (args.length < 1) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите предмет:\n ```!use <Название предмета>```')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const itemName = args.join(' ');
    const userId = message.author.id;

    db.get('SELECT quantity FROM inventory WHERE userId = ? AND itemName = ?', [userId, itemName], (err, item) => {
      if (err || !item) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('У вас нет этого предмета')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (item.quantity <= 1) {
        db.run('DELETE FROM inventory WHERE userId = ? AND itemName = ?', [userId, itemName]);
      } else {
        db.run('UPDATE inventory SET quantity = quantity - 1 WHERE userId = ? AND itemName = ?', [userId, itemName]);
      }

      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Использование предмета')
        .setDescription(`Использовано ${itemName}`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};