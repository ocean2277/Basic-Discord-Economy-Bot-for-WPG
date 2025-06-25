const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'giveitem',
  description: 'Выдать предмет пользователю (только для админов)',
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
        .setDescription('Укажите пользователя и предмет: ```!giveitem @user <предмет> [количество]```')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const user = message.mentions.users.first();
    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const itemName = args.slice(1).join(' ').toLowerCase();
    const quantity = args[args.length - 1] && !isNaN(parseInt(args[args.length - 1])) && parseInt(args[args.length - 1]) > 0 ? parseInt(args[args.length - 1]) : 1;
    const shopType = 1; 

    db.get('SELECT itemName FROM shop WHERE LOWER(itemName) = ?', [itemName], (err, shopItem) => {
      if (err) {
        console.error('Error checking shop:', err);
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при проверке магазина')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (shopItem) {
        insertIntoInventory(message, db, user, itemName, quantity, shopType);
      } else {
        db.get('SELECT itemName FROM shop2 WHERE LOWER(itemName) = ?', [itemName], (err, shop2Item) => {
          if (err) {
            console.error('Error checking shop2:', err);
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription('Ошибка при проверке магазина')
              .setFooter({ text: message.author.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }

          if (!shop2Item) {
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription(`Предмет **${itemName}** не найден в магазинах`)
              .setFooter({ text: message.author.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }

          insertIntoInventory(message, db, user, itemName, quantity, 2); 
        });
      }
    });
  },
};

function insertIntoInventory(message, db, user, itemName, quantity, shopType) {
  db.run(
    'INSERT OR REPLACE INTO inventory (userId, itemName, quantity, shopType) VALUES (?, ?, COALESCE((SELECT quantity FROM inventory WHERE userId = ? AND itemName = ? AND shopType = ?) + ?, ?), ?)',
    [user.id, itemName, user.id, itemName, shopType, quantity, quantity, shopType],
    (err) => {
      if (err) {
        console.error('Error adding to inventory:', err);
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Ошибка при добавлении предмета в инвентарь: ${err.message}`)
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Выдача предмета')
        .setDescription(`Выдан **${itemName}** (${quantity} шт.) пользователю ${user.username} (shopType: ${shopType})`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });

      console.log(`Item ${itemName} (${quantity}) added to inventory for user ${user.id}, shopType: ${shopType}`);
    }
  );
}