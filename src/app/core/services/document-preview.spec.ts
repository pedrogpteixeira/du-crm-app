import { getDocumentPreviewType } from './document-preview';

describe('getDocumentPreviewType', () => {
  it('identifica PDFs por MIME ou extensão', () => {
    expect(getDocumentPreviewType({ fileName: 'contrato.pdf' })).toBe('pdf');
    expect(getDocumentPreviewType({ fileName: 'ficheiro.bin', mimetype: 'application/pdf' })).toBe('pdf');
  });

  it('identifica imagens suportadas', () => {
    expect(getDocumentPreviewType({ originalName: 'foto.JPG' })).toBe('image');
    expect(getDocumentPreviewType({ fileName: 'imagem.bin', mimetype: 'image/png' })).toBe('image');
  });

  it('não trata SVG como preview de imagem', () => {
    expect(getDocumentPreviewType({ fileName: 'imagem.svg', mimetype: 'image/svg+xml' })).toBeNull();
  });

  it('identifica áudio reutilizando a política existente', () => {
    expect(getDocumentPreviewType({ originalName: 'chamada.mp3' })).toBe('audio');
  });

  it('não oferece preview para outros ficheiros', () => {
    expect(getDocumentPreviewType({ originalName: 'folha.xlsx' })).toBeNull();
  });
});
