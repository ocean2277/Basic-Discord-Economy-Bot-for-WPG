const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'shop2',
  description: 'Показать второй магазин',
  async execute(message, args, db) {
    const targetUser = message.author;
    const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 128 });

    db.all('SELECT * FROM shop2', [], (err, rows) => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при получении данных магазина')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      if (!rows.length) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Магазин 2')
          .setDescription('Магазин пуст')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      const itemsPerPage = 5;
      const pages = Math.ceil(rows.length / itemsPerPage);
      let currentPage = 0;

      const getEmbed = (page) => {
        const start = page * itemsPerPage;
        const end = start + itemsPerPage;
        const items = rows.slice(start, end)
          .map(row => `**${row.itemName}** - **${row.price}** ${config.cur} (В наличии: ${row.stock})${row.description ? `\n*${row.description}*` : ''}`)
          .join('\n\n');

        return new EmbedBuilder()
          .setColor('#9B909E')
          .setDescription(`**Акции**\n${items}`)
          .setFooter({ text: `${message.author.username} | Страница ${page + 1} из ${pages}` })
          .setThumbnail(avatarUrl)
          .setTimestamp();
      };

      const getButtons = (page) => {
        const row = new ActionRowBuilder();
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('prev_page')
            .setEmoji('⬅️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0)
        );
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('next_page')
            .setEmoji('➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === pages - 1)
        );
        return row;
      };

      message.channel.send({
        embeds: [getEmbed(currentPage)],
        components: pages > 1 ? [getButtons(currentPage)] : []
      }).then(sentMessage => {
        if (pages <= 1) return;

        const collector = sentMessage.createMessageComponentCollector({
          filter: i => i.user.id === message.author.id,
          time: 60000 // 60 секунд
        });

        collector.on('collect', async interaction => {
          if (interaction.customId === 'prev_page' && currentPage > 0) {
            currentPage--;
          } else if (interaction.customId === 'next_page' && currentPage < pages - 1) {
            currentPage++;
          }

          await interaction.update({
            embeds: [getEmbed(currentPage)],
            components: [getButtons(currentPage)]
          });
        });

        collector.on('end', () => {
          sentMessage.edit({ components: [] }).catch(() => {});
        });
      });
    });
  }
};