/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

interface UploaderProps {
    onImageUpload: (file: File) => void;
}

const Uploader: React.FC<UploaderProps> = ({ onImageUpload }) => {
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (file: File | null) => {
        if (file && file.type.startsWith('image/')) {
            onImageUpload(file);
        } else {
            alert('Пожалуйста, выберите файл изображения (png, jpg, webp).');
        }
    };

    const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };
    
    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };
    
    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };

    const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    };
    
    const handleClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <div
            onClick={handleClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            className={cn(
                "relative block w-full aspect-square rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center",
                isDragging && "border-blue-500 bg-blue-50"
            )}
        >
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/png, image/jpeg, image/webp"
                onChange={handleFileSelect}
            />
            <Icons.upload className="mx-auto h-12 w-12 text-gray-400" />
            <span className="mt-2 block text-sm font-medium text-gray-900">
                Перетащите фото сюда
            </span>
            <span className="mt-1 block text-xs text-gray-500">
                или нажмите для выбора файла
            </span>
        </div>
    );
};

export default Uploader;
