import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Modal, Image, Dimensions, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

// --- CLOUD INFRASTRUCTURE LINK ---
const SUPABASE_URL = 'https://dgeewroyceocxsedllxl.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRnZWV3cm95Y2VvY3hzZWRsbHhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzOTg4MjcsImV4cCI6MjA5NDk3NDgyN30.4MvtwxbQ4jE_zNJTWyfObbKIxlV8svHq6sqKJzavFVY';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const isDesktop = screenWidth >= 768;

  // --- SYSTEM AUTH & NAVIGATION ARCHITECTURE ---
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState('LOGIN'); 
  const [authLoading, setAuthLoading] = useState(false);
  
  const [currentView, setCurrentView] = useState('Feed'); // Feed, Discovery, Inbox, Profile
  const [isComposeVisible, setIsComposeVisible] = useState(false);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  // --- FORM VARIABLES & DATA POOLS ---
  const [newPostText, setNewPostText] = useState('');
  const [attachedMedia, setAttachedMedia] = useState(null); 
  const [logs, setLogs] = useState([]);
  const [discoverUsers, setDiscoverUsers] = useState([]);

  // --- INBOX SYSTEM VARIABLES ---
  const [activeChatUser, setActiveChatUser] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [inboxLoading, setInboxLoading] = useState(false);

  const [userProfile, setUserProfile] = useState({
    id: '',
    name: 'Explorer',
    handle: '@user',
    bio: 'Documenting structural networks and experiences.',
    avatar: ''
  });
  
  const [inputName, setInputName] = useState('');
  const [inputBio, setInputBio] = useState('');

  // --- LIFECYCLE SYNC OPERATIONS ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setUserProfile({ id: '', name: 'Explorer', handle: '@user', bio: '', avatar: '' });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      if (currentView === 'Feed') fetchCloudTimeline();
      if (currentView === 'Discovery') fetchDiscoverIndex();
      if (currentView === 'Inbox' && !activeChatUser) fetchDiscoverIndex();
    }
  }, [session, currentView]);

  // Real-time Message Streamer Sync
  useEffect(() => {
    if (!session || !activeChatUser) return;

    fetchChatHistory();

    const channel = supabase
      .channel('realtime-messages')
      .on('postgres_changes', { event: 'INSERT', scheme: 'public', table: 'messages' }, () => {
        fetchChatHistory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatUser, session]);

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUserProfile({
        id: userId,
        name: data.full_name || 'EXPLORER',
        handle: `@${data.username || 'user'}`,
        bio: data.bio || '',
        avatar: data.avatar_url || ''
      });
      setInputName(data.full_name || '');
      setInputBio(data.bio || '');
    }
  };

  const fetchCloudTimeline = async () => {
    setFeedLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, content, media_url, created_at, user_id, profiles ( id, full_name, username, avatar_url )')
      .order('created_at', { ascending: false });

    if (data) {
      setLogs(data.map(post => ({
        id: post.id,
        userId: post.user_id,
        user: post.profiles?.full_name || 'EXPLORER',
        handle: `@${post.profiles?.username || 'user'}`,
        avatar: post.profiles?.avatar_url || '',
        content: post.content,
        media: post.media_url,
        likes: Math.floor(Math.random() * 45) + 3 
      })));
    }
    setFeedLoading(false);
  };

  const fetchDiscoverIndex = async () => {
    if (!session) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', session.user.id)
      .limit(20);
    if (data) setDiscoverUsers(data);
  };

  const fetchChatHistory = async () => {
    if (!session || !activeChatUser) return;
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${activeChatUser.id}),and(sender_id.eq.${activeChatUser.id},receiver_id.eq.${session.user.id})`)
      .order('created_at', { ascending: true });
    if (data) setChatMessages(data);
  };

  // --- HARDWARE CAMERA & IMAGE SELECTION HANDLERS ---
  const pickImageHandler = async (target) => {
    Alert.alert(
      'Upload Media',
      'Choose an acquisition vector:',
      [
        { text: '📷 Take Live Photo', onPress: () => launchHardwareCamera(target) },
        { text: '🖼️ Open Gallery Library', onPress: () => launchMediaLibrary(target) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const launchHardwareCamera = async (target) => {
    const permissions = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert('Access Denied', 'Camera execution permissions required.');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3], base64: true });
    if (!result.canceled) {
      const base64Url = `data:image/jpeg;base64,${result.assets[0].base64}`;
      processSelectedImage(base64Url, target);
    }
  };

  const launchMediaLibrary = async (target) => {
    const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissions.granted) {
      Alert.alert('Access Denied', 'Gallery context permissions required.');
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [4, 3], base64: true });
    if (!result.canceled) {
      const base64Url = `data:image/jpeg;base64,${result.assets[0].base64}`;
      processSelectedImage(base64Url, target);
    }
  };

  const processSelectedImage = async (base64Data, target) => {
    if (target === 'POST') {
      setAttachedMedia(base64Data);
    } else if (target === 'PROFILE') {
      setUserProfile(prev => ({ ...prev, avatar: base64Data }));
      await supabase.from('profiles').update({ avatar_url: base64Data }).eq('id', session.user.id);
    } else if (target === 'CHAT') {
      // Instant image transmit configuration inside text channels
      await supabase.from('messages').insert([{
        sender_id: session.user.id,
        receiver_id: activeChatUser.id,
        content: '📷 Sent a photo',
        media_url: base64Data
      }]);
      fetchChatHistory();
    }
  };

  // --- USER CORE INTERACTION FLOWS ---
  const handleAuthentication = async () => {
    if (!authEmail || !authPassword) {
      Alert.alert('Verification Halt', 'All fields are required.');
      return;
    }
    setAuthLoading(true);
    if (authMode === 'SIGNUP') {
      const generatedUsername = authEmail.split('@')[0];
      const { error } = await supabase.auth.signUp({ 
        email: authEmail, 
        password: authPassword,
        options: { data: { username: generatedUsername, full_name: generatedUsername } }
      });
      if (error) {
        Alert.alert('Registration Error', error.message);
      } else {
        Alert.alert('Success', 'Profile registered. Welcome to TO PLACES.');
        setAuthMode('LOGIN');
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) Alert.alert('Access Denied', error.message);
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handlePublishPost = async () => {
    if (newPostText.trim() === '' && !attachedMedia) return;
    const { error } = await supabase
      .from('posts')
      .insert([{ user_id: session.user.id, content: newPostText, media_url: attachedMedia }]);

    if (error) {
      Alert.alert('Transaction Refused', error.message);
    } else {
      setNewPostText('');
      setAttachedMedia(null);
      setIsComposeVisible(false);
      fetchCloudTimeline();
    }
  };

  const saveProfileChanges = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: inputName, bio: inputBio })
      .eq('id', session.user.id);

    if (!error) {
      setUserProfile(prev => ({ ...prev, name: inputName, bio: inputBio }));
      setIsEditProfileVisible(false);
    } else {
      Alert.alert('Update Failure', error.message);
    }
  };

  const handleSendTextMessage = async () => {
    if (typedMessage.trim() === '') return;
    const { error } = await supabase
      .from('messages')
      .insert([{
        sender_id: session.user.id,
        receiver_id: activeChatUser.id,
        content: typedMessage
      }]);

    if (!error) {
      setTypedMessage('');
      fetchChatHistory();
    }
  };

  const renderAvatar = (avatarUrl, name, sizeStyle = styles.avatarMini) => {
    if (avatarUrl && avatarUrl.trim() !== '') {
      return <Image source={{ uri: avatarUrl }} style={sizeStyle} />;
    }
    const letter = name ? name.charAt(0).toUpperCase() : '?';
    return (
      <View style={[sizeStyle, styles.avatarFallback]}>
        <Text style={styles.avatarFallbackText}>{letter}</Text>
      </View>
    );
  };

  // --- LOG-IN GATE ---
  if (!session) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <View style={styles.authCard}>
          <Text style={styles.mainTitle}>TO <Text style={{color: '#FFD700'}}>PLACES</Text></Text>
          <View style={{ height: 20 }} />

          <TextInput style={styles.field} placeholder="Email Address" placeholderTextColor="#8E8E8A" value={authEmail} onChangeText={setAuthEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextInput style={styles.field} placeholder="Password" placeholderTextColor="#8E8E8A" secureTextEntry value={authPassword} onChangeText={setAuthPassword} />

          {authLoading ? (
            <ActivityIndicator size="small" color="#FFD700" style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity style={styles.primaryAuthBtn} onPress={handleAuthentication}>
              <Text style={styles.btnText}>{authMode === 'LOGIN' ? 'Log In' : 'Register Account'}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity onPress={() => setAuthMode(authMode === 'LOGIN' ? 'SIGNUP' : 'LOGIN')}>
            <Text style={styles.toggleAuthText}>
              {authMode === 'LOGIN' ? "Don't have an account? Register here" : 'Already have an account? Log In'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
        <View style={styles.workspace}>
          
          {/* POST COMPOSER */}
          <Modal visible={isComposeVisible} animationType="slide">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIsComposeVisible(false)}><Text style={styles.goldActionText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.greenActionBtn} onPress={handlePublishPost}><Text style={styles.btnText}>Publish</Text></TouchableOpacity>
              </View>
              <View style={styles.composeInputLayout}>
                {renderAvatar(userProfile.avatar, userProfile.name, styles.avatarMini)}
                <TextInput style={styles.inputArea} placeholder="Share anything, update friends, upload photos..." placeholderTextColor="#8E8E8A" multiline autoFocus value={newPostText} onChangeText={setNewPostText} />
              </View>
              {attachedMedia && (
                <View style={styles.mediaContainer}>
                  <Image source={{ uri: attachedMedia }} style={styles.imgPreview} />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setAttachedMedia(null)}><Text style={styles.btnText}>✕ Delete</Text></TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.mediaTray} onPress={() => pickImageHandler('POST')}>
                <Text style={styles.mediaTrayText}>📸 Attach / Capture Live Photo</Text>
              </TouchableOpacity>
            </SafeAreaView>
          </Modal>

          {/* EDIT PROFILE */}
          <Modal visible={isEditProfileVisible} animationType="fade">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIsEditProfileVisible(false)}><Text style={styles.goldActionText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.greenActionBtn} onPress={saveProfileChanges}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
              </View>
              <ScrollView style={{ padding: 20 }}>
                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                  <TouchableOpacity onPress={() => pickImageHandler('PROFILE')}>
                    {renderAvatar(userProfile.avatar, userProfile.name, styles.avatarLarge)}
                    <Text style={styles.photoLabelUpdate}>Change Identity Image</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>DISPLAY HANDLE RECOGNITION NAME</Text>
                <TextInput style={styles.field} value={inputName} onChangeText={setInputName} placeholderTextColor="#8E8E8A" />

                <Text style={styles.label}>METADATA BIO DESCRIPTION</Text>
                <TextInput style={[styles.field, { height: 120 }]} value={inputBio} onChangeText={setInputBio} placeholderTextColor="#8E8E8A" multiline />
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* CHAT INBOX DRAWER INTERFACE */}
          <Modal visible={activeChatUser !== null} animationType="slide">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setActiveChatUser(null)}><Text style={styles.goldActionText}>✕ Close</Text></TouchableOpacity>
                <Text style={styles.whiteBold}>{activeChatUser?.full_name}</Text>
                <TouchableOpacity onPress={() => pickImageHandler('CHAT')}><Text style={styles.mediaTrayText}>📷 Send Pic</Text></TouchableOpacity>
              </View>
              
              <ScrollView style={{ flex: 1, padding: 16 }}>
                {chatMessages.map(msg => {
                  const isMe = msg.sender_id === session.user.id;
                  return (
                    <View key={msg.id} style={[styles.msgBubble, isMe ? styles.msgMe : styles.msgThem]}>
                      <Text style={{ color: '#FFFFFF' }}>{msg.content}</Text>
                      {msg.media_url && <Image source={{ uri: msg.media_url }} style={styles.chatMediaImg} />}
                    </View>
                  );
                })}
              </ScrollView>

              <View style={styles.chatInputLayout}>
                <TextInput style={styles.chatTextInput} placeholder="Type secure chat transmission..." placeholderTextColor="#8E8E8A" value={typedMessage} onChangeText={setTypedMessage} />
                <TouchableOpacity style={styles.chatSendBtn} onPress={handleSendTextMessage}><Text style={styles.btnText}>Send</Text></TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>

          {/* TIMELINE FEED */}
          {currentView === 'Feed' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}>
                <Text style={styles.logo}>TO <Text style={{color: '#FFD700'}}>PLACES</Text></Text>
                <TouchableOpacity style={styles.greenActionBtn} onPress={() => setIsComposeVisible(true)}><Text style={styles.btnText}>+ Post</Text></TouchableOpacity>
              </View>
              {feedLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>
              ) : (
                <ScrollView style={{ flex: 1 }}>
                  {logs.map(log => (
                    <View key={log.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        {renderAvatar(log.avatar, log.user)}
                        <View style={{ marginLeft: 10, flex: 1 }}>
                          <Text style={styles.whiteBold}>{log.user}</Text>
                          <Text style={styles.greyText}>{log.handle}</Text>
                        </View>
                      </View>
                      <Text style={styles.contentText}>{log.content}</Text>
                      {log.media && <Image source={{ uri: log.media }} style={styles.postMedia} resizeMode="cover" />}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* DISCOVERY VIEW (RENAME MATRIX) */}
          {currentView === 'Discovery' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}><Text style={styles.logo}>DISCOVERY <Text style={{color: '#FFD700'}}>INDEX</Text></Text></View>
              <ScrollView style={{ padding: 12 }}>
                {discoverUsers.map(user => (
                  <View key={user.id} style={styles.discoverUserCard}>
                    {renderAvatar(user.avatar_url, user.full_name, styles.avatarLarge)}
                    <Text style={[styles.whiteBold, { marginTop: 10, fontSize: 16 }]}>{user.full_name || 'Anonymous'}</Text>
                    <Text style={[styles.greyText, { textAlign: 'center', marginTop: 6 }]} numberOfLines={2}>{user.bio || 'No profile descriptor cataloged.'}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* GLOBAL INBOX CHANNEL */}
          {currentView === 'Inbox' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}><Text style={styles.logo}>SECURE <Text style={{color: '#FFD700'}}>INBOX</Text></Text></View>
              <ScrollView style={{ flex: 1 }}>
                <Text style={styles.sectionHeader}>TAP ON A PROFILE TO INITIATE CHAT CONNECTION</Text>
                {discoverUsers.map(user => (
                  <TouchableOpacity key={user.id} style={styles.inboxUserRow} onPress={() => setActiveChatUser(user)}>
                    {renderAvatar(user.avatar_url, user.full_name, styles.avatarMini)}
                    <View style={{ marginLeft: 14 }}>
                      <Text style={styles.whiteBold}>{user.full_name || 'Network User'}</Text>
                      <Text style={styles.greyText}>Click to connect & send images</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* PROFILE CONNECTOR HUBS */}
          {currentView === 'Profile' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}>
                <Text style={styles.logo}>MY <Text style={{color: '#FFD700'}}>IDENTITY</Text></Text>
                <TouchableOpacity style={styles.logOutBtn} onPress={handleSignOut}><Text style={styles.redText}>Log Out</Text></TouchableOpacity>
              </View>
              <View style={styles.profileHub}>
                <TouchableOpacity onPress={() => pickImageHandler('PROFILE')}>
                  {renderAvatar(userProfile.avatar, userProfile.name, styles.avatarLarge)}
                </TouchableOpacity>
                <Text style={[styles.whiteBold, { fontSize: 22, marginTop: 12 }]}>{userProfile.name}</Text>
                <Text style={styles.greyText}>{userProfile.handle}</Text>
                <Text style={styles.bioText}>{userProfile.bio || "No profile bio description setup yet."}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditProfileVisible(true)}><Text style={styles.whiteBold}>Configure Profile / Photo</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* BOTTOM GLOBAL APP NAVIGATION */}
          <View style={styles.bottomNav}>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Feed')}><Text style={[styles.navText, currentView === 'Feed' && { color: '#FFD700' }]}>🎴 Feed</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Discovery')}><Text style={[styles.navText, currentView === 'Discovery' && { color: '#FFD700' }]}>⚡ Discovery</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Inbox')}><Text style={[styles.navText, currentView === 'Inbox' && { color: '#FFD700' }]}>💬 Inbox</Text></TouchableOpacity>
            <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Profile')}><Text style={[styles.navText, currentView === 'Profile' && { color: '#FFD700' }]}>👤 Profile</Text></TouchableOpacity>
          </View>

        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0C' },
  authContainer: { flex: 1, backgroundColor: '#0D0D0C', justifyContent: 'center', alignItems: 'center' },
  authCard: { width: '85%', padding: 24, backgroundColor: '#1A1A18', borderRadius: 16, borderWidth: 1, borderColor: '#262624', alignItems: 'center' },
  mainTitle: { color: '#FFFFFF', fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  primaryAuthBtn: { backgroundColor: '#FFD700', width: '100%', padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  toggleAuthText: { color: '#00B074', marginTop: 16, fontWeight: '700', fontSize: 13 },
  
  workspace: { flex: 1, backgroundColor: '#0D0D0C' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionHeader: { color: '#8E8E8A', fontSize: 11, fontWeight: '800', letterSpacing: 1, margin: 16 },

  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#262624' },
  logo: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  greenActionBtn: { backgroundColor: '#00B074', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  goldActionText: { color: '#FFD700', fontWeight: '700' },
  redText: { color: '#FF5A5F', fontWeight: '700' },
  whiteBold: { color: '#FFFFFF', fontWeight: '700' },
  greyText: { color: '#8E8E8A', fontSize: 13 },

  postCard: { backgroundColor: '#1A1A18', padding: 16, marginVertical: 6, marginHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#262624' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  contentText: { color: '#E6E6E6', fontSize: 15, lineHeight: 22 },
  postMedia: { width: '100%', height: 260, borderRadius: 8, marginTop: 12 },

  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#262624' },
  avatarLarge: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#262624', borderWidth: 2, borderColor: '#FFD700' },
  avatarFallback: { backgroundColor: '#3A3A36', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#FFD700', fontWeight: '900', fontSize: 20 },
  photoLabelUpdate: { color: '#00B074', fontWeight: '700', fontSize: 12, marginTop: 8, textAlign: 'center' },

  discoverUserCard: { backgroundColor: '#1A1A18', padding: 16, borderRadius: 16, marginHorizontal: 12, marginVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: '#262624' },
  inboxUserRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#1A1A18', backgroundColor: '#0D0D0C' },

  msgBubble: { padding: 12, borderRadius: 12, marginVertical: 4, maxWidth: '75%' },
  msgMe: { backgroundColor: '#00B074', alignSelf: 'flex-end' },
  msgThem: { backgroundColor: '#262624', alignSelf: 'flex-start' },
  chatMediaImg: { width: 180, height: 140, borderRadius: 8, marginTop: 6 },
  chatInputLayout: { flexDirection: 'row', padding: 12, backgroundColor: '#1A1A18', alignItems: 'center' },
  chatTextInput: { flex: 1, backgroundColor: '#0D0D0C', color: '#FFFFFF', padding: 12, borderRadius: 20, paddingHorizontal: 16 },
  chatSendBtn: { marginLeft: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#00B074', borderRadius: 20 },

  sheet: { flex: 1, backgroundColor: '#0D0D0C' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#262624', alignItems: 'center' },
  composeInputLayout: { flexDirection: 'row', padding: 16 },
  inputArea: { flex: 1, color: '#FFFFFF', paddingLeft: 12, fontSize: 16, textAlignVertical: 'top' },
  mediaTray: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#262624', backgroundColor: '#1A1A18' },
  mediaTrayText: { color: '#00B074', fontWeight: '700' },
  mediaContainer: { position: 'relative', margin: 16, height: 200 },
  imgPreview: { width: '100%', height: '100%', borderRadius: 8 },
  removeMediaBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FF5A5F', padding: 8, borderRadius: 12 },

  profileHub: { backgroundColor: '#1A1A18', padding: 24, margin: 12, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: '#262624' },
  bioText: { color: '#E6E6E6', textAlign: 'center', marginVertical: 16, lineHeight: 20 },
  editBtn: { backgroundColor: '#262624', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginTop: 12 },
  logOutBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#262624', borderRadius: 8 },
  label: { color: '#FFD700', fontSize: 11, fontWeight: '800', marginTop: 16 },
  field: { backgroundColor: '#1A1A18', color: '#FFFFFF', padding: 14, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#262624', width: '100%' },

  bottomNav: { flexDirection: 'row', height: 65, borderTopWidth: 1, borderTopColor: '#262624', backgroundColor: '#0D0D0C', paddingBottom: 10 },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#8E8E8A', fontWeight: '700', fontSize: 11 }
});
