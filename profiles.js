// Profile screens: choose who is playing, create a profile, delete one after typing its name.

function avatarImage(avatar, className) {
  const image = el('img', className);
  image.src = avatarUrl(avatar);
  image.alt = '';
  return image;
}

// canGoBack is false when the app starts here, so there is no screen to go back to
function showProfiles(direction = 'forward', canGoBack = true) {
  if (profiles.list.length === 0) return showNewProfile();
  show('profiles', () => {
    const container = $('profiles');
    container.replaceChildren();
    if (canGoBack && activeProfile()) {
      const back = el('button', 'link', t('back'));
      back.addEventListener('click', toMenu);
      container.append(back);
    }
    container.append(el('h2', '', t('whoIsPlaying')));

    const list = el('div', 'profile-list');
    for (const profile of profiles.list) {
      const row = el('div', 'profile-row');
      const choose = el('button', 'profile-choose');
      choose.setAttribute('aria-pressed', profile.id === profiles.active);
      choose.append(avatarImage(profile.avatar, 'avatar'), el('span', '', profile.name));
      choose.addEventListener('click', () => switchProfile(profile.id));
      const rename = el('button', 'icon-button rename', '✏️');
      rename.setAttribute('aria-label', t('renameNamed', profile.name));
      rename.title = t('renameNamed', profile.name);
      rename.addEventListener('click', () => showRenameProfile(profile));
      const remove = el('button', 'icon-button delete', '🗑');
      remove.setAttribute('aria-label', t('deleteNamed', profile.name));
      remove.title = t('deleteNamed', profile.name);
      remove.addEventListener('click', () => showDeleteProfile(profile));
      row.append(choose, rename, remove);
      list.append(row);
    }

    const add = el('button', 'big', t('newProfile'));
    add.addEventListener('click', showNewProfile);
    container.append(list, add);
  }, direction);
}

function showNewProfile() {
  const firstProfile = profiles.list.length === 0;
  const usedAvatars = profiles.list.map(profile => profile.avatar);
  let avatar = AVATARS.find(a => !usedAvatars.includes(a)) ?? AVATARS[0];
  // the screen is drawn again when a flag changes the language, so the name and focus must survive that
  let typedName = '';
  let firstRender = true;

  show('new-profile', () => {
    const container = $('new-profile');
    container.replaceChildren();
    if (!firstProfile) {
      const back = el('button', 'link', t('back'));
      back.addEventListener('click', () => showProfiles('back'));
      container.append(back);
    }
    container.append(el('h2', '', t(firstProfile ? 'welcome' : 'newProfileTitle')));
    if (firstProfile) {
      container.append(languagePicker(), el('p', 'privacy', t('privacyNote')), el('p', 'small', t('welcomeHelp')));
    }

    const name = el('input', 'text-input');
    name.id = 'profile-name';
    name.value = typedName;
    name.maxLength = MAX_NAME_LENGTH;
    name.autocomplete = 'off';
    const label = el('label', 'field-label', t('profileName'));
    label.htmlFor = name.id;
    const error = el('p', 'warning', t('nameTaken'));
    error.hidden = true;

    const grid = el('div', 'avatar-grid');
    const avatarButtons = AVATARS.map((option, index) => {
      const button = el('button', 'avatar-option');
      button.append(avatarImage(option, 'avatar'));
      button.setAttribute('aria-label', t('picture', index + 1));
      button.disabled = usedAvatars.includes(option) && option !== avatar;
      button.addEventListener('click', () => {
        avatar = option;
        update();
      });
      grid.append(button);
      return button;
    });

    const create = el('button', 'primary big', t('createProfile'));
    const nameIsTaken = () => profiles.list.some(profile => sameName(profile.name, name.value));
    const update = () => {
      AVATARS.forEach((option, i) => avatarButtons[i].setAttribute('aria-pressed', option === avatar));
      error.hidden = !nameIsTaken();
      create.disabled = name.value.trim() === '' || nameIsTaken();
    };
    const submit = () => {
      if (!create.disabled) switchProfile(createProfile(name.value, avatar));
    };
    name.addEventListener('input', () => {
      typedName = name.value;
      update();
    });
    name.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    create.addEventListener('click', submit);

    container.append(label, name, error, el('h3', '', t('choosePicture')), grid, create);
    update();
    if (firstRender) name.focus();
    firstRender = false;
  });
}

function showRenameProfile(profile) {
  let typedName = profile.name; // kept when a language change draws the screen again

  show('rename-profile', () => {
    const container = $('rename-profile');
    const back = el('button', 'link', t('back'));
    back.addEventListener('click', () => showProfiles('back'));

    const heading = el('div', 'profile-heading');
    heading.append(avatarImage(profile.avatar, 'avatar'), el('h2', '', t('renameNamed', profile.name)));

    const name = el('input', 'text-input');
    name.id = 'rename-name';
    name.maxLength = MAX_NAME_LENGTH;
    name.autocomplete = 'off';
    name.value = typedName;
    const label = el('label', 'field-label', t('profileName'));
    label.htmlFor = name.id;
    const error = el('p', 'warning', t('nameTaken'));

    const saveButton = el('button', 'primary big', t('saveName'));
    const nameIsTaken = () => profiles.list.some(other => other.id !== profile.id && sameName(other.name, name.value));
    const update = () => {
      error.hidden = !nameIsTaken();
      saveButton.disabled = name.value.trim() === '' || nameIsTaken();
    };
    const submit = () => {
      if (saveButton.disabled) return;
      renameProfile(profile.id, name.value);
      renderStatic(); // the header shows the current player's name
      showProfiles('back');
    };
    name.addEventListener('input', () => {
      typedName = name.value;
      update();
    });
    name.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    saveButton.addEventListener('click', submit);

    container.replaceChildren(back, heading, label, name, error, saveButton);
    update();
    name.focus();
  });
}

function showDeleteProfile(profile) {
  show('delete-profile', () => {
    const container = $('delete-profile');
    const back = el('button', 'link', t('back'));
    back.addEventListener('click', () => showProfiles('back'));

    const heading = el('div', 'profile-heading');
    heading.append(avatarImage(profile.avatar, 'avatar'), el('h2', '', t('deleteNamed', profile.name)));

    const confirmation = el('input', 'text-input');
    confirmation.id = 'delete-confirmation';
    confirmation.autocomplete = 'off';
    const label = el('label', 'field-label', t('typeNameToConfirm', profile.name));
    label.htmlFor = confirmation.id;

    const remove = el('button', 'danger big', t('deleteForGood'));
    remove.disabled = true;
    confirmation.addEventListener('input', () => { remove.disabled = !sameName(confirmation.value, profile.name); });
    remove.addEventListener('click', () => {
      if (remove.disabled) return;
      deleteProfile(profile.id);
      showProfiles('back');
    });

    container.replaceChildren(back, heading, el('p', '', t('deleteWarning', profile.name)), label, confirmation, remove);
    confirmation.focus();
  });
}
