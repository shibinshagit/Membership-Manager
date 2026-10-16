'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Meeting = {
  id: number;
  title: string;
  meeting_date: string;
  template: string;
};

type Attendee = {
  member_id: number;
  present: boolean;
  full_name: string;
  member_code: string;
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [template, setTemplate] = useState<'central' | 'executive'>('central');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [present, setPresent] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  const loadMeetings = useCallback(async () => {
    const res = await fetch('/api/meetings');
    const data = await res.json();
    setMeetings(data.meetings || []);
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  async function openMeeting(id: number) {
    setSelectedId(id);
    const res = await fetch(`/api/meetings/${id}`);
    const data = await res.json();
    const rows: Attendee[] = data.attendees || [];
    setAttendees(rows);
    setPresent(rows.filter((row) => row.present).map((row) => row.member_id));
  }

  async function createMeeting() {
    setMessage('');
    const res = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, meeting_date: meetingDate, template }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Could not create the meeting.');
      return;
    }
    setTitle('');
    await loadMeetings();
    await openMeeting(data.meeting.id);
  }

  async function saveAttendance() {
    if (!selectedId) return;
    const res = await fetch(`/api/meetings/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ present_member_ids: present }),
    });
    setMessage(res.ok ? 'Attendance saved.' : 'Could not save attendance.');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meetings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a meeting from the current central committee or executive list, then mark who attended.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-lg border border-border/80 bg-card p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          createMeeting();
        }}
      >
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="meeting-title">Title</Label>
          <Input id="meeting-title" value={title} onChange={(event) => setTitle(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="meeting-date">Date</Label>
          <Input id="meeting-date" type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="meeting-template">Attendance list</Label>
          <select
            id="meeting-template"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={template}
            onChange={(event) => setTemplate(event.target.value as 'central' | 'executive')}
          >
            <option value="central">Current central committee</option>
            <option value="executive">Current executive</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit">Create meeting</Button>
        </div>
      </form>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <ul className="space-y-2">
          {meetings.map((meeting) => (
            <li key={meeting.id}>
              <button
                type="button"
                className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => openMeeting(meeting.id)}
              >
                <span className="block font-medium">{meeting.title}</span>
                <span className="text-xs text-muted-foreground">
                  {meeting.meeting_date} · {meeting.template === 'executive' ? 'Executive' : 'Central committee'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border/80 bg-card p-4">
          {attendees.length === 0 ? (
            <p className="text-sm text-muted-foreground">Select a meeting to mark attendance.</p>
          ) : (
            <div className="space-y-3">
              {attendees.map((person) => (
                <label key={person.member_id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={present.includes(person.member_id)}
                    onChange={() =>
                      setPresent((current) =>
                        current.includes(person.member_id)
                          ? current.filter((id) => id !== person.member_id)
                          : [...current, person.member_id]
                      )
                    }
                  />
                  {person.full_name} · {person.member_code}
                </label>
              ))}
              <Button type="button" onClick={saveAttendance}>Save attendance</Button>
            </div>
          )}
          {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </div>
  );
}
