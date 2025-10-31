/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Icons } from './Icons';
import { cn } from '../lib/utils';

interface UploaderProps {
    onImageUpload: (file: File) => void;
    fileInputRef?: React.RefObject<HTMLInputElement>;
}

const Uploader: React.FC<UploaderProps> = ({ onImageUpload, fileInputRef: externalRef }) => {
    const [isDragging, setIsDragging] = useState(false);
    const internalRef = useRef<HTMLInputElement>(null);
    const fileInputRef = externalRef || internalRef;

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
                "relative block w-full aspect-square rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center shadow-sm",
                isDragging 
                    ? "border-blue-400 bg-blue-50 shadow-md scale-[1.02]" 
                    : "border-gray-300 hover:border-blue-300 hover:bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
