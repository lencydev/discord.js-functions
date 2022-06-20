import { Command } from '@structures/command';
import { Context } from '@interfaces/context';

import { Color, Data } from '@config';

import { inspect } from 'util';

import {
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
} from 'discord.js';

import {
  EmbedBuilder as Embed,
  ActionRowBuilder as ActionRow,
  ModalBuilder as Modal,
  TextInputBuilder as TextInput,
} from '@discordjs/builders';

import { evalFunction } from './eval-function';

export default class extends Command {

  constructor() {
    super({
      name: 'eval',
      description: 'Evaluates code and execute.',

      cooldown: false,

      category: 'developer',
      usage: false,
  
      devOnly: true,
      ownerOnly: false,
      permissions: false,

      enabled: true,
    });
  };

  async execute ({ ctx, interaction }: { ctx: Context; interaction: ChatInputCommandInteraction; }): Promise<void> {

    await interaction.showModal(
      new Modal({ title: `Eval`, custom_id: 'eval' }).addComponents(
        new ActionRow<TextInput>().addComponents(
          new TextInput({
            type: 4,
            style: 2,
            custom_id: `code`,
            label: `Code`,
            required: true,
          }),
        ),
        new ActionRow<TextInput>().addComponents(
          new TextInput({
            type: 4,
            style: 1,
            custom_id: `ephemeral`,
            label: `Ephemeral Response (true/false)`,
            placeholder: `true/false`,
            value: 'false',
            min_length: 4,
            max_length: 5,
            required: false,
          }),
        ),
      ),
    );

    await interaction.awaitModalSubmit({ filter: (modal: ModalSubmitInteraction) => modal.customId === 'eval', time: 5 * 60 * 1000 }).then(async (modal: ModalSubmitInteraction) => {

      function clean (value: any): any {
  
        if (typeof (value) === 'string') return value.replace(/`/g, '`' + String.fromCharCode(8203)).replace(/@/g, '@' + String.fromCharCode(8203));
        return value;
      };
  
      try {
    
        let code: string = modal.fields.getTextInputValue('code');
        let ephemeral: boolean = modal.fields.getTextInputValue('ephemeral').toLowerCase() === 'true' ? true : false;
  
        let evaled: string;
        
        if (code.includes('await')) evaled = inspect(eval(`(async () => { ${code} })()`));
        if (!code.includes('await')) evaled = inspect(eval(code));
  
        let secretValues: string[] = [
          Data.Token,
        ];
  
        await Promise.all(secretValues.map((value: string) => evaled = evaled.replaceAll(value, `❓`)));
  
        await evalFunction(modal, {
          users: [ modal.user ],
          ephemeral,
          pageSize: 1000,
          result: clean(evaled),
          embeds: (value: string, firstIndex: number, lastIndex: number, page: number, pages: number) => {
            return [
              new Embed({
                color: Color.Default,
                author: {
                  name: `Eval`,
                },
                fields: [
                  { name: `Type`, value: `${typeof value}`, inline: true },
                  { name: `Length`, value: `${value.length}`, inline: true },
                  { name: `Result (${page}/${pages})`, value: `\`\`\`ts\n${value.slice(firstIndex, lastIndex)}\`\`\``, inline: false },
                ],
              }),
            ];
          },
        });
  
      } catch (error) {
    
        await modal.reply({ ephemeral: true, content: `\`\`\`ts\n${clean(error).length > 2000 ? `${clean(error).slice(0, 2000)}...` : `${clean(error)}`}\n\`\`\`` });
      };
    });
  };
};
