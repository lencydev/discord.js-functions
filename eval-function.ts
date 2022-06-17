import {
  User,
  Message,
  ButtonInteraction,
  ModalSubmitInteraction,
  InteractionCollector,
  ComponentType,
} from 'discord.js';

import {
  EmbedBuilder as Embed,
  ActionRowBuilder as ActionRow,
  ButtonBuilder as Button,
  ModalBuilder as Modal,
  TextInputBuilder as TextInput,
  MessageActionRowComponentBuilder as MessageActionRowComponent,
} from '@discordjs/builders';

import {
  APIMessage,
} from 'discord-api-types/v10';

type ButtonNames = 'previous' | 'next' | 'search' | 'delete';

interface EvalMenuOptions {

  users: User[];
  ephemeral?: boolean;
  result: string;
  embed: Embed;
};

export async function evalFunction (interaction: ModalSubmitInteraction, options: EvalMenuOptions): Promise<void> {

  const {
    users,
    ephemeral = false,
    result,
    embed,
  } = options;

  let defaultStyles = {
    previous: 2,
    next: 2,
    search: 1,
    delete: 4,
  };

  let defaultEmojis = {
    previous: '950306098773118986',
    next: '950306098643107860',
    search: '986719684638412890',
    delete: '950305604621180978',
  };

  let p: number = 1;

  let firstIndex: number = 0;
  let lastIndex: number = 1000;

  let pages: number = Math.ceil(result.length / 1000);

  let generateButtons = (status?: boolean): Button[] => {

    let checkPage = (button: ButtonNames): boolean => {

      if (([ 'previous' ] as ButtonNames[]).includes(button) && p === 1) return true;
      if (([ 'next' ] as ButtonNames[]).includes(button) && p === pages) return true;

      return false;
    };

    let buttons: ButtonNames[] = [ 'previous', 'next' ];
    if (pages > 2) buttons = [ ...buttons, 'search' ];
    if (!ephemeral) buttons = [ ...buttons, 'delete' ];

    return buttons.reduce((buttons: Button[], button: ButtonNames): Button[] => {

      buttons.push(new Button({ style: defaultStyles[button], emoji: { id: defaultEmojis[button] }, custom_id: button, disabled: status || checkPage(button) }));

      return buttons;
    }, []);
  };

  let components = (status?: boolean): ActionRow<MessageActionRowComponent>[] => [

    new ActionRow<MessageActionRowComponent>().addComponents(...generateButtons(status)),
  ];

  let page = (): Embed[] => {

    let oldEmbed: Embed = embed.setFields(
      { name: `Type`, value: `${typeof result}`, inline: true },
      { name: `Length`, value: `${result.length}`, inline: true },
      { name: `Result (${p}/${pages})`, value: `\`\`\`ts\n${result.slice(firstIndex, lastIndex)}\`\`\``, inline: false },
    );
    let newEmbed: Embed = new Embed(oldEmbed.data);

    if (oldEmbed?.data.footer?.text) return [ newEmbed.setFooter({ text: oldEmbed.data.footer.text, iconURL: oldEmbed.data.footer.icon_url }) ];
    return [ newEmbed ];
  };

  await interaction.reply({ ephemeral, embeds: page(), components: components(), fetchReply: true }).then((fetch: Message | APIMessage) => {

    let collector: InteractionCollector<ButtonInteraction> = (fetch as Message).createMessageComponentCollector({ componentType: ComponentType.Button, time: 5 * 60 * 1000 });

    collector.on('end', async () => await interaction.editReply({ components: components(true) }).catch(() => null));
    
    collector.on('collect', async (button: ButtonInteraction) => {

      if (users.some((user: User) => user.id !== button.user.id)) {

        await button.deferUpdate();
        
        await button.followUp({ ephemeral: true, content: `You cannot use this button.` }); return;
      };

      let id: ButtonNames = button.customId as ButtonNames;

      if (id === 'previous') p--, firstIndex = firstIndex -1000, lastIndex = lastIndex -1000;
      if (id === 'next') p++, firstIndex = firstIndex +1000, lastIndex = lastIndex +1000;
      if (id === 'delete') return await interaction.deleteReply();

      if (id === 'search') {

        await button.showModal(
          new Modal({ title: `Page Selection`, custom_id: 'page-selection' }).addComponents(
            new ActionRow<TextInput>().addComponents(
              new TextInput({
                type: 4,
                style: 1,
                custom_id: `page`,
                label: `Select Page (1-${pages})`,
                placeholder: `1-${pages}`,
                value: String(p),
                min_length: 1,
                max_length: String(pages).length,
                required: true,
              }),
            ),
          ),
        );

        return await button.awaitModalSubmit({ filter: (modal: ModalSubmitInteraction) => modal.customId === 'page-selection', time: 5 * 60 * 1000 }).then(async (modal: ModalSubmitInteraction) => {

          let pageValue: number = Number(modal.fields.getTextInputValue('page'));

          if (isNaN(pageValue) || pageValue > pages) return await modal.reply({ content: `The value does not fit the format.` });
          if (pageValue === p) return await modal.reply({ content: `Enter page number other than the selected page.` });

          p = pageValue;

          firstIndex = p * 1000 -1000;
          lastIndex = p * 1000;

          await interaction.editReply({ embeds: page(), components: components() });

          if (modal.isFromMessage()) await modal.deferUpdate();
        });
      };

      await interaction.editReply({ embeds: page(), components: components() });

      await button.deferUpdate();
    });
  });
};
