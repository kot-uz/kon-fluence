/**
 * Системный диалог выбора файлов вне React (для slash-меню). Promise не разрешается при отмене.
 * Input добавляется в DOM: иначе часть браузеров не присылает change у отсоединённого элемента.
 */
export const pickFiles = ({
  accept,
  multiple = true,
}: { accept?: string; multiple?: boolean } = {}) =>
  new Promise<File[]>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) input.accept = accept;
    input.style.display = 'none';

    const cleanup = () => input.remove();
    input.addEventListener(
      'change',
      () => {
        const files = Array.from(input.files || []);
        cleanup();
        if (files.length) resolve(files);
      },
      { once: true }
    );
    input.addEventListener('cancel', cleanup, { once: true });

    document.body.appendChild(input);
    input.click();
  });
