// @ts-nocheck
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

/** Активация расширения
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	addSubscription({
		command: 'extension.createComponent',
		callback: createComponent,
		context
	});

	addSubscription({
		command: 'extension.createContainer',
		callback: createContainer,
		context
	});
}

/**
 * Добавление подписки/команды
 * 
 * @param { string } command название команды
 * @param { function } callback метода команды
 * @param { object } context контекст расширения
 */
const addSubscription = ({
	command = '',
	callback = () => {},
	context = {}
} = {}) => {
	context.subscriptions
		.push(
			vscode.commands.registerCommand(
				command,
				callback));
}

/**
 * Возвращает экземпляр текущего расширения
 * 
 * @returns { Extension<any> } расширение
 */
const getCurrentExtension = () => vscode.extensions.getExtension(
	'locko.locko-react-tools') || {};

/**
 * Возвращает путь к текущему расширению
 * 
 * @returns { string } путь
 */
const getCurrentExtensionPath = () => getCurrentExtension().extensionPath || '';

/** Типы шаблонов */
const Templates = {
	/** Компонент */
	Component: 'component',

	/** Контейнер */
	Container: 'container'
}

/**
 * Возвращает путь к шаблону
 * 
 * @param { Templates } type тип шаблона
 * 
 * @returns { string } путь
 */
const getTemplatePath = ({
	type = Templates.Component
} = {}) => `${getCurrentExtensionPath()}${path.sep}templates${path.sep}${type}${path.sep}`;

/**
 * Возвращает путь к основному файлу шаблона
 * 
 * @param { Templates } type тип шаблона
 * 
 * @returns { string } путь
 */
const getPrimaryTemplateFilePath = ({
	type = Templates.Component
} = {}) => `${getTemplatePath({
	type
})}${type}.tmpl`;

/**
 * Возвращает путь к файлу экспортов шаблона
 * 
 * @param { Templates } type тип шаблона
 * 
 * @returns { string } путь
 */
const getIndexTemplateFilePath = ({
	type = Templates.Component
} = {}) => `${getTemplatePath({
	type
})}index.tmpl`;

/**
 * Открывает файл
 * 
 * @param { string } path путь к файлу
 * 
 * @returns { Thenable<TextDocument> } файл
 */
const openFile = ({
	path = ''
} = {}) => vscode.workspace.openTextDocument(path);

/**
 * Преобразует файл шаблона в файл компонента
 * 
 * @param { Thenable<TextDocument> } doc файл
 * @param { string } name имя компонента
 * @param { string } file путь к новому файлу
 * 
 */
const transformTemplateAndSave = ({
	doc,
	name = '',
	file = ''
} = {}) => fs
	.writeFileSync(
		file,
		doc.getText()
			.split('${name}')
			.join(name)
			.split('${name_lower}')
			.join(name.toLowerCase()));

/** Добавляет экспорт модуля в файл
 * 
 * @param { Thenable<TextDocument> } doc файл
 * @param { string } name имя модуля
 * 
 */
const addExport = ({ name = '', doc = null } = {}) => {
	let text = doc.getText();
	text = text + `
export {
	${name}
} from './${name}';
`;

	fs.writeFileSync(doc.fileName, text);
}
/**
 * Преобразует шаблон в файлы компонента
 * 
 * @param { string } type тип шаблона
 * @param { string } name имя компонента
 * @param { string } pathToComponent путь к каталогу компонента
 * @param { string } commonPath путь к каталогу общих компонентов (.Common)
 * @param { string } componentsPath путь к каталогу компонентов (components)
 * 
 */
const processComponentTemplate = ({
	type = '',
	name = '',
	pathToComponent = '',
	commonPath = '',
	componentsPath = ''
} = {})  => {
	const primaryFileName = `${pathToComponent}${path.sep}${name}.jsx`;

	new Promise((resolve) => resolve(fs.mkdirSync(pathToComponent)))
		.then(() => {
			return openFile({
				path: getPrimaryTemplateFilePath({
					type
				})
			});
		})
		.then((doc) => {
			transformTemplateAndSave( { doc, file: primaryFileName, name });
		})
		.then(() => {
			return openFile({
				path: getIndexTemplateFilePath({
					type
				})
			});
		})
		.then((doc) => {
			transformTemplateAndSave( { doc, file: `${pathToComponent}${path.sep}index.js`, name });
		})
		.then(() => {
			return openFile({
				path: `${getTemplatePath()}styled.tmpl`
			});
		})
		.then((doc) => {
			transformTemplateAndSave( { doc, file: `${pathToComponent}${path.sep}styled.jsx`, name });
		})
		.then(() => {
			return openFile({
				path: `${commonPath}${path.sep}index.js`
			});
		})
		.then((doc) => {
			addExport({
				doc,
				name
			});
		})
		.then(() => {
			return openFile({
				path: `${componentsPath}${path.sep}index.js`
			});
		})
		.then((doc) => {
			let text = doc.getText();
			const rows = text.split('\r\n');

			const newRows = rows.reduce(function (acc, curr, index, arr) {
				if (curr === '} from \'./.Common\';') {
					if (arr[index - 1].endsWith(',')) {
						return [
							...acc,
							`  ${name},`,
							curr
						];
					}

					const addedComma = [
						...acc
					];

					// todo: slice/splice
					addedComma[index - 1] = arr[index - 1] + ',';

					return [
						...addedComma,
						`  ${name},`,
						curr
					];
				}

				return [
					...acc,
					curr
				];
			}, []);

			fs.writeFileSync(doc.fileName, newRows.join('\r\n'));
		})
		.then(() => {
			return openFile({ path: primaryFileName })
				.then((doc) => {
			    	vscode.window.showTextDocument(doc);
				});
		})
		.catch((e) => {
			vscode.window.showErrorMessage(e.message);
		});
}

const createComponent = (args) => {
	const incomingPath = args._fsPath;
	vscode.window.showInputBox({
		ignoreFocusOut: true,
		prompt: 'Введите имя компонента',
		value: 'NewComponent'
	}).then((name) => {

		if (!name) {
			return;
		}

		const commonPath = `${incomingPath}${path.sep}.Common`;
		const newFilePath = `${commonPath}${path.sep}${name}`;

		if (fs.existsSync(newFilePath)) {
			vscode.window.showErrorMessage("Компонент уже существует");
			return;
		}

		processComponentTemplate({
			type: Templates.Component,
			name,
			pathToComponent: newFilePath,
			commonPath,
			componentsPath: incomingPath
		});
	});
}

/**
 * Преобразует шаблон в файлы контейнера
 * 
 * @param { string } type тип шаблона
 * @param { string } name имя контейнера
 * @param { string } pathToContainer путь к каталогу контейнера
 * @param { string } containersPath путь к каталогу контейнеров (containers)
 * 
 */
const processContainerTemplate = ({
	type = '',
	name = '',
	pathToContainer = '',
	containersPath = ''
} = {})  => {
	const primaryFileName = `${pathToContainer}${path.sep}${name}.jsx`;

	new Promise((resolve) => resolve(fs.mkdirSync(pathToContainer)))
		.then(() => {
			return openFile({
				path: getPrimaryTemplateFilePath({
					type
				})
			});
		})
		.then((doc) => {
			transformTemplateAndSave( { doc, file: primaryFileName, name });
		})
		.then(() => {
			return openFile({
				path: getIndexTemplateFilePath({
					type
				})
			});
		})
		.then((doc) => {
			transformTemplateAndSave( { doc, file: `${pathToContainer}${path.sep}index.js`, name });
		})
		.then(() => {
			return openFile({
				path: `${containersPath}${path.sep}index.js`
			});
		})
		.then((doc) => {
			addExport({
				doc,
				name
			});
		})
		.then(() => {
			return openFile({ path: primaryFileName })
				.then((doc) => {
			    	vscode.window.showTextDocument(doc);
				});
		})
		.catch((e) => {
			vscode.window.showErrorMessage(e.message);
		});
}

const createContainer = (args) => {
	const incomingPath = args._fsPath;
	vscode.window.showInputBox({
		ignoreFocusOut: true,
		prompt: 'Введите имя контейнера',
		value: 'NewContainer'
	}).then((name) => {

		if (!name) {
			return;
		}

		const newFilePath = `${incomingPath}${path.sep}${name}`;

		if (fs.existsSync(newFilePath)) {
			vscode.window.showErrorMessage("Контейнер уже существует");
			return;
		}

		processContainerTemplate({
			type: Templates.Container,
			name,
			pathToContainer: newFilePath,
			containersPath: incomingPath
		});
	});
}

exports.activate = activate;

/**
 * Деактивация расширения
 */
function deactivate() {}

module.exports = {
	activate,
	deactivate
}
