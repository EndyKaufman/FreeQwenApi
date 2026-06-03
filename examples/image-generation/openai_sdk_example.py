"""
Пример использования генерации изображений через OpenAI Python SDK
Полная совместимость с openai-python библиотекой
"""

from openai import OpenAI
import os
from datetime import datetime

# Настройка клиента для вашего API
client = OpenAI(
    base_url='http://localhost:3000/v1',  # URL вашего API
    api_key='your-api-key'  # Или из переменной окружения OPENAI_API_KEY
)

def generate_image():
    """Генерация изображения через OpenAI SDK"""
    try:
        print('🎨 Генерация изображения через OpenAI Python SDK...')
        
        response = client.images.generate(
            prompt='A beautiful sunset over the ocean with dramatic clouds',
            model='dall-e-3',  # Будет замаплено на qwen-image-max
            size='1024x1024',
            n=1
        )
        
        print('✅ Изображение сгенерировано!')
        print(f'URL: {response.data[0].url}')
        print(f'Revised prompt: {response.data[0].revised_prompt}')
        print(f'Created: {datetime.fromtimestamp(response.created).isoformat()}')
        
        return response.data[0].url
        
    except Exception as error:
        print(f'❌ Ошибка: {error}')
        return None

def list_image_models():
    """Получение списка моделей для генерации изображений"""
    try:
        print('\n📋 Список моделей для генерации изображений:')
        
        models = client.models.list()
        image_models = [
            m for m in models.data 
            if hasattr(m, 'capabilities') and 'image_generation' in m.capabilities
        ]
        
        for model in image_models:
            print(f'  - {model.id} ({model.owned_by})')
            
    except Exception as error:
        print(f'❌ Ошибка: {error}')

def generate_multiple_images():
    """Генерация нескольких изображений"""
    try:
        print('\n🎨 Генерация нескольких изображений...')
        
        response = client.images.generate(
            prompt='A cute cat sitting on a windowsill looking outside',
            model='qwen-image-plus',
            size='1024x1024',
            n=1  # Можно увеличить, если API поддерживает
        )
        
        print(f'✅ Сгенерировано {len(response.data)} изображений:')
        for i, image in enumerate(response.data, 1):
            print(f'  {i}. {image.url}')
        
    except Exception as error:
        print(f'❌ Ошибка: {error}')

if __name__ == '__main__':
    # Запуск примеров
    generate_image()
    list_image_models()
    generate_multiple_images()
