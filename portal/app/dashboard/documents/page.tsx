'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PageHeader, FilterBar } from '@/components/dashboard/page-header';
import {
  DataList,
  DataListCard,
  DataListEmpty,
  DataListHead,
  DataListLoading,
  DataListRow,
  DataListScroll,
  EntityAvatar,
  EntityMeta,
  StatusBadge,
  DOC_LIST_COLS,
} from '@/components/dashboard/data-list';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  FolderOpen,
  Upload,
  Trash2,
  Eye,
  Download,
  Search,
  Loader2,
  IdCard,
  BookUser,
  Camera,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { AppIcon } from '@/components/icons/app-icon';
import { IconTileBox } from '@/components/icons/icon-tile';
import { MemberCombobox } from '@/components/members/member-combobox';

interface Document {
  id: number;
  member_id: number;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  member_name: string;
  member_code: string;
  uploaded_by_name: string | null;
  created_at: string;
}

interface Member {
  id: number;
  full_name: string;
  member_id: string;
}

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const memberIdFromUrl = searchParams.get('member_id') || 'all';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadData, setUploadData] = useState({
    member_id: searchParams.get('member_id') || '',
    document_type: 'emirates_id',
    file: null as File | null,
  });

  const fetchDocuments = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterType !== 'all') params.set('type', filterType);
    if (memberIdFromUrl !== 'all') params.set('member_id', memberIdFromUrl);

    try {
      const res = await fetch(`/api/documents?${params}`);
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [filterType, memberIdFromUrl]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch('/api/members?limit=1000');
      const data = await res.json();
      setMembers(data.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
    fetchMembers();
  }, [fetchDocuments, fetchMembers]);

  const handleUpload = async () => {
    if (!uploadData.file || !uploadData.member_id) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('member_id', uploadData.member_id);
    formData.append('document_type', uploadData.document_type);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setDialogOpen(false);
        setUploadData({ member_id: '', document_type: 'emirates_id', file: null });
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' });
      fetchDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'emirates_id':
        return <AppIcon icon={IdCard} className="h-5 w-5" />;
      case 'passport':
        return <AppIcon icon={BookUser} className="h-5 w-5" />;
      case 'photo':
        return <AppIcon icon={Camera} className="h-5 w-5" />;
      default:
        return <AppIcon icon={FileText} className="h-5 w-5" />;
    }
  };

  const formatDocumentType = (type: string) => {
    return type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.member_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.member_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPreviewUrl = (doc: Document) =>
    `/api/documents/file?pathname=${encodeURIComponent(doc.file_path)}`;

  const isPdf = (doc: Document) =>
    doc.mime_type === 'application/pdf' || doc.file_name.toLowerCase().endsWith('.pdf');

  const isImage = (doc: Document) =>
    doc.mime_type?.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(doc.file_name);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage member documents"
        actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <AppIcon icon={Upload} className="h-4 w-4" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Select a member and upload their document
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Member *</Label>
                <MemberCombobox
                  members={members}
                  value={uploadData.member_id}
                  onValueChange={(v) => setUploadData({ ...uploadData, member_id: v })}
                />
              </div>
              <div className="space-y-2">
                <Label>Document Type *</Label>
                <Select
                  value={uploadData.document_type}
                  onValueChange={(v) => setUploadData({ ...uploadData, document_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="emirates_id">Emirates ID</SelectItem>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="photo">Member Photo</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>File *</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) =>
                    setUploadData({ ...uploadData, file: e.target.files?.[0] || null })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Accepted: Images, PDF. Max size: 5MB
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || !uploadData.file || !uploadData.member_id}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        }
      />

      <FilterBar>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <AppIcon
                icon={Search}
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                placeholder="Search by member name, ID, or filename..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="emirates_id">Emirates ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="photo">Member Photo</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </FilterBar>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-4xl h-[85vh] max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewDoc?.file_name || 'Document Preview'}</DialogTitle>
            <DialogDescription>
              {previewDoc ? `${formatDocumentType(previewDoc.document_type)} - ${previewDoc.member_name}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 rounded-md border overflow-hidden bg-muted/20">
            {previewDoc && isImage(previewDoc) && (
              <img
                src={getPreviewUrl(previewDoc)}
                alt={previewDoc.file_name}
                className="w-full h-full object-contain"
              />
            )}
            {previewDoc && isPdf(previewDoc) && (
              <iframe
                src={getPreviewUrl(previewDoc)}
                title={previewDoc.file_name}
                className="w-full h-full"
              />
            )}
            {previewDoc && !isImage(previewDoc) && !isPdf(previewDoc) && (
              <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Preview not supported for this file type.
                </p>
                <Button asChild>
                  <a
                    href={getPreviewUrl(previewDoc)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open File
                  </a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <DataList>
        {loading ? (
          <DataListLoading />
        ) : filteredDocuments.length === 0 ? (
          <DataListEmpty
            icon={FolderOpen}
            title="No documents found"
            description={
              searchTerm || filterType !== 'all' || memberIdFromUrl !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Upload your first document to get started'
            }
          />
        ) : (
          <>
            <div className="md:hidden">
              {filteredDocuments.map((doc) => (
                <DataListCard key={doc.id}>
                  <div className="flex min-w-0 items-start gap-3">
                    <IconTileBox size="md">{getDocumentIcon(doc.document_type)}</IconTileBox>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate font-medium">{doc.file_name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDocumentType(doc.document_type)} · {formatFileSize(doc.file_size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <EntityAvatar name={doc.member_name} className="h-8 w-8 text-xs" />
                    <EntityMeta
                      title={doc.member_name}
                      subtitle={`${doc.member_code} · ${format(new Date(doc.created_at), 'PP')}`}
                      href={`/dashboard/members/${doc.member_id}`}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => {
                        setPreviewDoc(doc);
                        setPreviewOpen(true);
                      }}
                      title="Preview"
                    >
                      <AppIcon icon={Eye} className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon-sm" asChild>
                      <a
                        href={`/api/documents/file?pathname=${encodeURIComponent(doc.file_path)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                      >
                        <AppIcon icon={Download} className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <AppIcon icon={Trash2} className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {doc.file_name}. This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </DataListCard>
              ))}
            </div>

            <DataListScroll className="hidden md:block" minWidth="44rem">
              <DataListHead
                className={DOC_LIST_COLS}
                columns={[
                  { key: 'member', label: 'Member' },
                  { key: 'type', label: 'Type' },
                  { key: 'size', label: 'Size' },
                  { key: 'uploaded', label: 'Uploaded' },
                  { key: 'actions', label: 'Actions', className: 'text-right' },
                ]}
              />
              {filteredDocuments.map((doc) => (
                <DataListRow key={doc.id} className={DOC_LIST_COLS}>
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <EntityAvatar name={doc.member_name} className="h-9 w-9 text-xs" />
                    <EntityMeta
                      title={doc.member_name}
                      subtitle={doc.member_code}
                      href={`/dashboard/members/${doc.member_id}`}
                    />
                  </div>
                  <div className="flex min-w-0 items-center gap-3 overflow-hidden">
                    <IconTileBox size="sm">{getDocumentIcon(doc.document_type)}</IconTileBox>
                    <div className="min-w-0 overflow-hidden">
                      <StatusBadge tone="neutral">{formatDocumentType(doc.document_type)}</StatusBadge>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{doc.file_name}</p>
                    </div>
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), 'PP')}
                  </p>
                  <div className="flex items-center justify-end gap-1 !overflow-visible">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => {
                        setPreviewDoc(doc);
                        setPreviewOpen(true);
                      }}
                      title="Preview"
                    >
                      <AppIcon icon={Eye} className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon-sm" className="shrink-0" asChild>
                      <a
                        href={`/api/documents/file?pathname=${encodeURIComponent(doc.file_path)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                      >
                        <AppIcon icon={Download} className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          className="shrink-0 text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <AppIcon icon={Trash2} className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete {doc.file_name}. This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(doc.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </DataListRow>
              ))}
            </DataListScroll>
          </>
        )}
      </DataList>
    </div>
  );
}
