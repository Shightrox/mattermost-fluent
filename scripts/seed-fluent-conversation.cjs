// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
// Small, repeatable visual fixture. Never connects to a work server.
const fs = require('fs');
const assert = require('assert/strict');
(async () => {
    const lab = JSON.parse(fs.readFileSync('artifacts/fluent-lab-session.json', 'utf8'));
    assert.equal(lab.origin, 'http://localhost:18065');
    async function api(route, data, token = lab.token) {
        const response = await fetch(lab.origin + '/api/v4' + route, {
            method: data ? 'POST' : 'GET',
            headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
            body: data ? JSON.stringify(data) : undefined,
        });
        if (!response.ok) throw Error(route + ': ' + response.status);
        return {data: await response.json(), token: response.headers.get('Token')};
    }
    const team = (await api('/teams/name/' + lab.team)).data;
    const channels = (await api('/users/me/teams/' + team.id + '/channels')).data;
    const channel = channels.find(c => c.name === 'conversation-preview') || (await api('/channels', {
        team_id: team.id, name: 'conversation-preview', display_name: 'Дизайн продукта', type: 'O',
        header: 'Макеты, идеи и маленькие детали',
    })).data;
    const peer = (await api('/users/username/fluent-peer')).data;
    const members = (await api('/channels/' + channel.id + '/members')).data;
    if (!members.some(m => m.user_id === peer.id)) await api('/channels/' + channel.id + '/members', {user_id: peer.id});
    const peerLogin = await api('/users/login', {login_id: 'fluent-peer', password: 'FluentLab-Only-2026!'});
    const posts = (await api('/channels/' + channel.id + '/posts')).data;
    if (!Object.values(posts.posts).some(post => !post.type)) {
        for (const [own, message] of [
            [false, 'Привет! Посмотрел новую версию. Теперь гораздо легче сосредоточиться на разговоре.'],
            [false, 'Особенно нравится, что действия под рукой, но не спорят с текстом.'],
            [true, 'Да, хочется больше воздуха и меньше визуального шума.'],
            [false, 'Давай оставим спокойный фон, а цвет используем только там, где он помогает.'],
            [true, 'Согласен. **Следующий шаг:**\n• проверить узкое окно\n• пройтись по светлой теме\n• собрать обратную связь'],
            [true, 'И обязательно сохранить удобный ввод с клавиатуры.'],
            [false, 'Отлично, вечером посмотрю ✨'],
        ]) await api('/posts', {channel_id: channel.id, message}, own ? lab.token : peerLogin.token);
    }
    const latest = (await api('/channels/' + channel.id + '/posts')).data;
    const root = Object.values(latest.posts).find(post => post.message.startsWith('Согласен. **Следующий шаг:**'));
    if (root && !root.reply_count) await api('/posts', {channel_id: channel.id, root_id: root.id, message: 'Проверил светлую тему. Можно показывать команде.'}, peerLogin.token);
    if (root) {
        const reactions = (await api('/posts/' + root.id + '/reactions')).data;
        if (!reactions?.some(reaction => reaction.user_id === peer.id && reaction.emoji_name === 'thumbsup')) {
            await api('/reactions', {user_id: peer.id, post_id: root.id, emoji_name: 'thumbsup'}, peerLogin.token);
        }
    }
    if (!Object.values(latest.posts).some(post => post.file_ids?.length)) {
        const form = new FormData();
        form.set('channel_id', channel.id);
        form.set('files', new Blob(['Fluent conversation review\nKeyboard, themes, attachments, threads.'], {type: 'text/plain'}), 'conversation-review.txt');
        const upload = await fetch(lab.origin + '/api/v4/files', {method: 'POST', headers: {Authorization: 'Bearer ' + lab.token}, body: form});
        if (!upload.ok) throw Error('Local fixture upload: ' + upload.status);
        const file = (await upload.json()).file_infos[0];
        await api('/posts', {channel_id: channel.id, message: 'Собрал замечания в один файл.', file_ids: [file.id]});
    }
    console.log('Synthetic conversation ready: /' + lab.team + '/channels/' + channel.name);
})().catch(error => {console.error(error); process.exit(1);});
