const { 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder 
} = require('discord.js');
const Settings = require('../models/settings');

async function updateSetting(guildId, field, value) {
    let doc = await Settings.findOne({ guildId });
    if (!doc) doc = new Settings({ guildId });
    if (typeof value === 'object' && !Array.isArray(value)) {
        doc.set(field, value);
        doc.markModified(field);
    } else doc[field] = value;
    await doc.save();
}

module.exports = {
    name: 'interactionCreate',
    async execute(interaction) {
        if (!interaction.guild) return;

        const settingsMenuIds = new Set(['settings_menu', 'roles_menu', 'embeds_menu', 'vehiclelist_menu', 'trailerlist_menu']);
        const settingsModalPrefixes = ['role_modal_', 'embed_modal_'];
        const settingsModalExactIds = new Set([
            'welcome_channel_modal',
            'logging_channel_modal',
            'embed_color_modal',
            'vehicle_caps_modal',
            'vehiclelist_add',
            'vehiclelist_remove',
            'trailerlist_add',
            'trailerlist_remove'
        ]);

        if (interaction.isStringSelectMenu() && !settingsMenuIds.has(interaction.customId)) return;
        if (interaction.isModalSubmit()) {
            const hasKnownPrefix = settingsModalPrefixes.some(prefix => interaction.customId.startsWith(prefix));
            if (!hasKnownPrefix && !settingsModalExactIds.has(interaction.customId)) return;
        }
        if (!interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

        const guildId = interaction.guild.id;
        const settings = await Settings.findOne({ guildId });
        const color = settings?.embedcolor || '#0099ff';

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'settings_menu') {
                switch (interaction.values[0]) {
                    case 'roles': {
                        const embed = new EmbedBuilder()
                            .setTitle('Roles Configuration')
                            .setDescription('Select a role category to configure (up to 4 roles, first required)')
                            .setColor(color);
                        const row = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('roles_menu')
                                .setPlaceholder('Select role category')
                                .addOptions([
                                    { label: 'Law Enforcement Officers', value: 'leoRoleId' },
                                    { label: 'Civilian', value: 'civiRoleId' },
                                    { label: 'Early Access', value: 'eaRoleId' },
                                    { label: 'Staff', value: 'staffRoleId' },
                                    { label: 'Administrators', value: 'adminRoleId' },
                                ])
                        );
                        return interaction.update({ embeds: [embed], components: [row], flags: 64 });
                    }

                    case 'welcomechannelid': {
                        const modal = new ModalBuilder()
                            .setCustomId('welcome_channel_modal')
                            .setTitle('Set Welcome Channel ID')
                            .addComponents(
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('welcome_channel_input')
                                        .setLabel('Welcome Channel ID')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                )
                            );
                        return interaction.showModal(modal);
                    }

                    case 'loggingchannelid': {
                        const modal = new ModalBuilder()
                            .setCustomId('logging_channel_modal')
                            .setTitle('Set Logging Channel ID')
                            .addComponents(
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('logging_channel_input')
                                        .setLabel('Logging Channel ID')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                )
                            );
                        return interaction.showModal(modal);
                    }

                    case 'embeds': {
                        const embed = new EmbedBuilder()
                            .setTitle('Embeds Configuration')
                            .setDescription('Select an embed category to configure')
                            .setColor(color);
                        const row = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId('embeds_menu')
                                .setPlaceholder('Select embed category')
                                .addOptions([
                                    { label: 'Startup Embed', value: 'startupEmbed' },
                                    { label: 'EA Embed', value: 'eaEmbed' },
                                    { label: 'Giveaway Embed', value: 'giveawayEmbed' },
                                    { label: 'Welcome Embed', value: 'welcomeEmbed' },
                                    { label: 'Cohost Embed', value: 'cohostEmbed' },
                                    { label: 'Ticket Support Panel', value: 'ticketSupportEmbed' },
                                    { label: 'Release Embed', value: 'releaseEmbed' },
                                    { label: 'Reinvites Embed', value: 'reinvitesEmbed' },
                                    { label: 'Over Embed', value: 'overEmbed' },
                                ])
                        );
                        return interaction.update({ embeds: [embed], components: [row], ephemeral: true });
                    }

                    case 'embed_colors': {
                        const modal = new ModalBuilder()
                            .setCustomId('embed_color_modal')
                            .setTitle('Set Embed Color')
                            .addComponents(
                                new ActionRowBuilder().addComponents(
                                    new TextInputBuilder()
                                        .setCustomId('embed_color_input')
                                        .setLabel('Hex Color (e.g., #FF0000)')
                                        .setStyle(TextInputStyle.Short)
                                        .setRequired(true)
                                )
                            );
                        return interaction.showModal(modal);
                    }

                        case 'vehicle_caps': {
                            const currentCaps = Array.isArray(settings?.vehicleCaps)
                                ? settings.vehicleCaps.map(v => `${v.roleId}:${v.cap}`).join('\n')
                                : '';
                            const modal = new ModalBuilder()
                                .setCustomId('vehicle_caps_modal')
                                .setTitle('Set Vehicle Caps')
                                .addComponents(
                                    new ActionRowBuilder().addComponents(
                                        new TextInputBuilder()
                                            .setCustomId('vehicle_caps_input')
                                            .setLabel('roleId:cap (one per line)')
                                            .setStyle(TextInputStyle.Paragraph)
                                            .setRequired(true)
                                            .setValue(currentCaps || 'ROLE_ID:6')
                                    )
                                );
                            return interaction.showModal(modal);
                        }

                    case 'vehicle_list':
                    case 'trailer_list': {
                        const type = interaction.values[0] === 'vehicle_list' ? 'vehiclelist' : 'trailerlist';
                        const currentList = settings?.[type] || 'No items yet';
                        const embed = new EmbedBuilder()
                            .setTitle(`${type.replace('list','').toUpperCase()} List`)
                            .setDescription(`Current items:\n${currentList}\nSelect an action below:`)
                            .setColor(color);
                        const row = new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`${type}_menu`)
                                .setPlaceholder('Choose action')
                                .addOptions([
                                    { label: 'Add', value: 'add' },
                                    { label: 'Remove', value: 'remove' },
                                ])
                        );
                        return interaction.update({ embeds: [embed], components: [row], ephemeral: true });
                    }
                }
            }

            const roleFields = ['leoRoleId','civiRoleId','eaRoleId','staffRoleId','adminRoleId'];
            if (roleFields.includes(interaction.values[0])) {
                const field = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`role_modal_${field}`).setTitle('Set Roles');
                for (let i = 1; i <= 4; i++) {
                    modal.addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId(`role_input_${i}`)
                                .setLabel(`Role ID ${i}${i===1?' (Required)':''}`)
                                .setStyle(TextInputStyle.Short)
                                .setRequired(i===1)
                        )
                    );
                }
                return interaction.showModal(modal);
            }

            const embedFields = ['startupEmbed','eaEmbed','giveawayEmbed','setupEmbed','welcomeEmbed','cohostEmbed','cohostendEmbed','ticketSupportEmbed','releaseEmbed','reinvitesEmbed','overEmbed'];
            if (embedFields.includes(interaction.values[0])) {
                const field = interaction.values[0];
                const currentEmbed = settings?.[field] || {};
                const modal = new ModalBuilder().setCustomId(`embed_modal_${field}`).setTitle('Set Embed');
                const components = [
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('title_input')
                            .setLabel('Title')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true)
                            .setValue(currentEmbed.title || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('desc_input')
                            .setLabel('Description')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(false)
                            .setValue(currentEmbed.description || '')
                    ),
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('image_input')
                            .setLabel('Image URL')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setValue(currentEmbed.image || '')
                    )
                ];

                if (field === 'ticketSupportEmbed') {
                    components.push(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('placeholder_input')
                                .setLabel('Dropdown Placeholder')
                                .setStyle(TextInputStyle.Short)
                                .setRequired(false)
                                .setValue(currentEmbed.placeholder || '')
                        )
                    );
                }

                modal.addComponents(...components);
                return interaction.showModal(modal);
            }

            if (interaction.customId === 'vehiclelist_menu' || interaction.customId === 'trailerlist_menu') {
                const type = interaction.customId.includes('vehicle') ? 'vehiclelist' : 'trailerlist';
                const action = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`${type}_${action}`).setTitle(`${action.toUpperCase()} ${type}`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(
                        new TextInputBuilder()
                            .setCustomId('list_input')
                            .setLabel('Enter each item on a new line')
                            .setStyle(TextInputStyle.Paragraph)
                            .setRequired(true)
                    )
                );
                return interaction.showModal(modal);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('role_modal_')) {
                const field = interaction.customId.replace('role_modal_','');
                const roles = [];
                for (let i = 1; i <= 4; i++) {
                    const value = interaction.fields.getTextInputValue(`role_input_${i}`)?.trim();
                    if (value) roles.push(value);
                }
                if (roles.length === 0) return interaction.reply({ content: 'At least one role is required!', flags: 64 });
                await updateSetting(guildId, field, roles.join(','));
                return interaction.reply({ content: 'Roles updated successfully!', flags: 64 });
            }

            if (interaction.customId === 'welcome_channel_modal') {
                const channel = interaction.fields.getTextInputValue('welcome_channel_input');
                await updateSetting(guildId, 'welcomechannelid', channel);
                return interaction.reply({ content: `Welcome channel set to <#${channel}>`, flags: 64 });
            }
            if (interaction.customId === 'logging_channel_modal') {
                const channel = interaction.fields.getTextInputValue('logging_channel_input');
                await updateSetting(guildId, 'logChannelId', channel);
                return interaction.reply({ content: `Logging channel set to <#${channel}>`, flags: 64 });
            }

            if (interaction.customId.startsWith('embed_modal_')) {
                const field = interaction.customId.replace('embed_modal_','');
                const title = interaction.fields.getTextInputValue('title_input');
                const description = interaction.fields.getTextInputValue('desc_input') || null;
                const image = interaction.fields.getTextInputValue('image_input') || null;
                const embedData = { title, description, image };
                if (field === 'ticketSupportEmbed') {
                    embedData.placeholder = interaction.fields.getTextInputValue('placeholder_input') || null;
                }
                await updateSetting(guildId, field, embedData);
                return interaction.reply({ content: 'Embed updated successfully!', flags: 64 });
            }

            if (interaction.customId === 'embed_color_modal') {
                const colorInput = interaction.fields.getTextInputValue('embed_color_input').trim();
                if (!/^#?[0-9a-fA-F]{6}$/.test(colorInput)) {
                    return interaction.reply({
                        content: 'Invalid hex color. Use `#RRGGBB` or `RRGGBB`.',
                        flags: 64,
                    });
                }

                const normalizedColor = colorInput.startsWith('#') ? colorInput : `#${colorInput}`;
                await updateSetting(guildId, 'embedcolor', normalizedColor);
                return interaction.reply({ content: `Global embed color set to ${normalizedColor}.`, flags: 64 });
            }

            if (interaction.customId === 'vehicle_caps_modal') {
                const raw = interaction.fields.getTextInputValue('vehicle_caps_input') || '';
                const lines = raw.split('\n').map(line => line.trim()).filter(Boolean);
                const vehicleCaps = [];

                for (const line of lines) {
                    const [roleIdRaw, capRaw] = line.split(':').map(v => (v || '').trim());
                    const cap = Number(capRaw);
                    if (!roleIdRaw || !Number.isFinite(cap) || cap < 0) {
                        return interaction.reply({
                            content: 'Invalid format. Use one `roleId:cap` pair per line, e.g. `123456789012345678:6`.',
                            flags: 64,
                        });
                    }
                    vehicleCaps.push({ roleId: roleIdRaw, cap: Math.floor(cap) });
                }

                await updateSetting(guildId, 'vehicleCaps', vehicleCaps);
                return interaction.reply({ content: 'Vehicle caps updated successfully!', flags: 64 });
            }

            if (interaction.customId.endsWith('_add') || interaction.customId.endsWith('_remove')) {
                const type = interaction.customId.includes('vehicle') ? 'vehiclelist' : 'trailerlist';
                const items = interaction.fields.getTextInputValue('list_input').split('\n').map(i=>i.trim()).filter(i=>i);
                const current = (await Settings.findOne({ guildId }))?.[type]?.split('\n') || [];
                if (interaction.customId.endsWith('_add')) {
                    await updateSetting(guildId, type, [...current, ...items].join('\n'));
                    return interaction.reply({ content: 'Items added successfully!', flags: 64 });
                } else {
                    await updateSetting(guildId, type, current.filter(i=>!items.includes(i)).join('\n'));
                    return interaction.reply({ content: 'Items removed successfully!', flags: 64 });
                }
            }
        }
    }
};
