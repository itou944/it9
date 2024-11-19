const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const mfolderPath = path.join(__dirname, 'Mfolder');
const filesListPath = path.join(__dirname, 'FilesList.json');

const generateId = () => Math.random().toString(36).substr(2, 9);

async function getFilesList() {
    try {
        const data = await fs.readFile(filesListPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

async function saveFilesList(data) {
    await fs.writeFile(filesListPath, JSON.stringify(data, null, 2), 'utf-8');
}

async function initializeServer() {
    try {
        await fs.mkdir(mfolderPath, { recursive: true });
        const filesList = await getFilesList();
        await saveFilesList(filesList);
        console.log('Server initialized successfully');
    } catch (error) {
        console.error('Failed to initialize server:', error);
        process.exit(1);
    }
}

// Create folder
app.post('/folders', async (req, res) => {
    try {
        const { folderName } = req.body;
        
        if (!folderName?.trim()) {
            return res.status(400).json({ error: 'Valid folder name is required' });
        }

        const folderId = generateId();
        const newFolderPath = path.join(mfolderPath, `${folderName}_${folderId}`);
        
        const filesData = await getFilesList();
        
        if (filesData.some(f => f.Folder_name === folderName)) {
            return res.status(409).json({ error: 'Folder name already exists' });
        }
        
        await fs.mkdir(newFolderPath);
        filesData.push({ 
            Folder_id: folderId, 
            Folder_name: folderName, 
            files: [],
            createdAt: new Date().toISOString()
        });
        
        await saveFilesList(filesData);
        
        res.status(201).json({ 
            id: folderId,
            name: folderName,
            path: `${folderName}_${folderId}`,
            createdAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ error: 'Failed to create folder', details: error.message });
    }
});

// Get all folders
app.get('/folders', async (req, res) => {
    try {
        const filesData = await getFilesList();
        res.json({ folders: filesData });
    } catch (error) {
        console.error('Error retrieving folders:', error);
        res.status(500).json({ error: 'Failed to retrieve folders', details: error.message });
    }
});

// Create file
app.post('/files', async (req, res) => {
    try {
        const { folderPath, fileName, content } = req.body;
        
        if (!folderPath?.trim() || !fileName?.trim()) {
            return res.status(400).json({ error: 'Folder path and file name are required' });
        }

        const filesData = await getFilesList();
        const [folderName, folderId] = folderPath.split('_');
        const folder = filesData.find(f => f.Folder_id === folderId);
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const targetFolderPath = path.join(mfolderPath, folderPath);
        try {
            await fs.access(targetFolderPath);
        } catch {
            return res.status(404).json({ error: 'Folder not found in filesystem' });
        }

        const fileId = generateId();
        const filePath = `${fileName}_${fileId}.js`;
        const fullFilePath = path.join(targetFolderPath, filePath);
        
        await fs.writeFile(fullFilePath, content || '');

        const now = new Date().toISOString();
        folder.files.push({ 
            File_id: fileId, 
            File_name: fileName,
            File_path: filePath,
            createdAt: now,
            lastModified: now
        });
        
        await saveFilesList(filesData);
        
        res.status(201).json({ 
            id: fileId,
            name: fileName,
            path: filePath,
            createdAt: now,
            lastModified: now
        });
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ error: 'Failed to create file', details: error.message });
    }
});

// Get file content
app.get('/files/:folderPath/:fileName', async (req, res) => {
    try {
        const { folderPath, fileName } = req.params;
        const filePath = path.join(mfolderPath, folderPath, fileName);
        
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }

        const content = await fs.readFile(filePath, 'utf-8');
        res.json({ content });
    } catch (error) {
        console.error('Error retrieving file:', error);
        res.status(500).json({ error: 'Failed to retrieve file', details: error.message });
    }
});

// Update file
app.put('/files/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { folderPath, content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'File content is required' });
        }

        const filesData = await getFilesList();
        const folder = filesData.find(f => f.files.some(file => file.File_id === fileId));
        
        if (!folder) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = folder.files.find(f => f.File_id === fileId);
        const filePath = path.join(mfolderPath, folderPath, file.File_path);
        
        await fs.writeFile(filePath, content);
        
        const now = new Date().toISOString();
        file.lastModified = now;
        
        await saveFilesList(filesData);
        
        res.json({ 
            success: true,
            lastModified: now
        });
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ error: 'Failed to update file', details: error.message });
    }
});

// Delete file
app.delete('/files/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;
        const { folderPath } = req.body;

        const filesData = await getFilesList();
        const folder = filesData.find(f => f.files.some(file => file.File_id === fileId));
        
        if (!folder) {
            return res.status(404).json({ error: 'File not found' });
        }

        const file = folder.files.find(f => f.File_id === fileId);
        const filePath = path.join(mfolderPath, folderPath, file.File_path);
        
        await fs.unlink(filePath);
        
        folder.files = folder.files.filter(f => f.File_id !== fileId);
        await saveFilesList(filesData);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file', details: error.message });
    }
});

// Delete folder
app.delete('/folders/:folderId', async (req, res) => {
    try {
        const { folderId } = req.params;

        const filesData = await getFilesList();
        const folder = filesData.find(f => f.Folder_id === folderId);
        
        if (!folder) {
            return res.status(404).json({ error: 'Folder not found' });
        }

        const folderPath = path.join(mfolderPath, `${folder.Folder_name}_${folderId}`);
        await fs.rm(folderPath, { recursive: true });
        
        const updatedFilesData = filesData.filter(f => f.Folder_id !== folderId);
        await saveFilesList(updatedFilesData);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ error: 'Failed to delete folder', details: error.message });
    }
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

initializeServer().then(() => {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`Mfolder path: ${mfolderPath}`);
        console.log(`FilesList path: ${filesListPath}`);
    });
}).catch(console.error);

module.exports = app;