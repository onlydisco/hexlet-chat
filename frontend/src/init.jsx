import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import * as leoProfanity from 'leo-profanity';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import ApiContext from './contexts/ApiContext.js';
import store from './slices/index.js';
import App from './App.jsx';
import resources from './locales/index.js';
import { actions as messagesActions } from './slices/messagesInfoSlice.js';
import { actions as channelsActions } from './slices/channelsInfoSlice.js';

const init = async (socket) => {
  const i18n = i18next.createInstance();
  await i18n.use(initReactI18next).init({
    resources,
    fallbackLng: 'ru',
  });

  const russianDictionary = leoProfanity.getDictionary('ru');
  leoProfanity.add(russianDictionary);

  const withAcknowledgement = (socketFunc) => (...args) => new Promise((resolve, reject) => {
    /* eslint-disable-next-line */
        let state = "pending";

    const timer = setTimeout(() => {
      state = 'rejected';
      reject();
    }, 3000);

    socketFunc(...args, (response) => {
      if (state !== 'pending') return;

      clearTimeout(timer);

      if (response.status === 'ok') {
        state = 'resolved';
        resolve(response.data);
      }

      reject();
    });
  });

  const api = {
    sendMessage: withAcknowledgement((...args) => socket.emit('newMessage', ...args)),
    addChannel: withAcknowledgement((...args) => socket.emit('newChannel', ...args)),
    renameChannel: withAcknowledgement((...args) => socket.emit('renameChannel', ...args)),
    removeChannel: withAcknowledgement((...args) => socket.emit('removeChannel', ...args)),
  };

  socket.on('newMessage', (messageWithId) => {
    store.dispatch(messagesActions.addMessage(messageWithId));
  });
  socket.on('newChannel', (channelWithId) => {
    store.dispatch(channelsActions.addChannel(channelWithId));
    store.dispatch(channelsActions.setCurrentChannelId(channelWithId.id));
  });
  socket.on('renameChannel', (channel) => {
    store.dispatch(
      channelsActions.renameChannel({ id: channel.id, changes: channel }),
    );
  });
  socket.on('removeChannel', (data) => {
    store.dispatch(channelsActions.removeChannel(data.id));
  });

  return (
    <Provider store={store}>
      <BrowserRouter>
        <I18nextProvider i18n={i18n}>
          <ApiContext.Provider value={api}>
            <App />
          </ApiContext.Provider>
        </I18nextProvider>
      </BrowserRouter>
    </Provider>
  );
};

export default init;
