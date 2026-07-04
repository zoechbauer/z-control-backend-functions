export interface GoogleTranslateResponse {
    data: {
        translations: Array<{ translatedText: string }>;
    };
}
