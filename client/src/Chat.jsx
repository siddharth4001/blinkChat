import { useContext, useEffect, useRef, useState } from "react";
import Avatar from "./Avatar";
import axios from "axios";
import Contact from "./Contact";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import { uniqBy } from "lodash";
export default function Chat() {
    const [ws, setWs] = useState(null);
    const [onlinePeople, setOnlinePeople] = useState({});
    const [offlinePeople, setOfflinePeople] = useState({});
    const [selectedUserId, setSelectedUserId] = useState(null);
    const { username, id, setId, setUsername } = useContext(UserContext);
    const [newMessageText, setNewMessageText] = useState('');
    const divUnderMessages = useRef();
    const [messages, setMessages] = useState([]);

    useEffect(() => {
        connectToWs();
    }, [selectedUserId]);

    //trie to reconnect whenever a user tries to disconnect from the server 
    function connectToWs() {
        const ws = new WebSocket('ws://localhost:4040');
        setWs(ws);
        ws.addEventListener('message', handleMessage);
        ws.addEventListener('close', () => {
            setTimeout(() => {
                // console.log('Disconnected! Trying to reconnect...');
                connectToWs();
            }, 1000);
        });
    }

    function showOnlinePeople(peopleArray) {
        const people = {};
        peopleArray.forEach(({ userId, username }) => {
            people[userId] = username;
        });
        setOnlinePeople(people);
    }

    function handleMessage(ev) {
        const messageData = JSON.parse(ev.data);
        // console.log({ ev, messageData });
        if ('online' in messageData) {
            showOnlinePeople(messageData.online);
        } else if ('text' in messageData) {
            if (messageData.sender === selectedUserId) {
                setMessages(prev => ([...prev, { ...messageData }]));
            }
        }
    }

    function logout() {
        axios.post('/logout').then(() => {
            setWs(null);
            setId(null);
            setUsername(null);
        })
    }

    function sendMessage(ev, file=null) {
        if(ev) ev.preventDefault();
        ws.send(JSON.stringify({
            recipient: selectedUserId,
            text: newMessageText,
            file
        }));
        setNewMessageText('');
        setMessages(prev => ([...prev, {
            text: newMessageText,
            sender: id,
            recipient: selectedUserId,
            _id: Date.now(),
        }]));
        if(file){
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        }
    }

    function sendFile(ev){
        const reader = new FileReader();
        reader.readAsDataURL(ev.target.files[0]);
        reader.onload = () => {
            sendMessage(null, {
                name: ev.target.files[0].name,
                data: reader.result,
            });
        };
    }

    useEffect(() => {
        const div = divUnderMessages.current;
        if (div) {
            div.scrollIntoView({ behaviour: 'smooth', block: 'end' });
        }
    }, [messages]);

    useEffect(() => {
        axios.get('/people').then(res => {
            const offlinePeopleArr = res.data.filter(p => p._id !== id).filter(p => !Object.keys(onlinePeople).includes(p._id));
            const offlinePeople = {};
            offlinePeopleArr.forEach(p => {
                offlinePeople[p._id] = p;
            });
            setOfflinePeople(offlinePeople);
        });
    }, [onlinePeople]);
    useEffect(() => {
        if (selectedUserId) {
            axios.get('/messages/' + selectedUserId).then(res => {
                setMessages(res.data);
            });
        }
    }, [selectedUserId]);



    const onlinePeopleExlOurUser = { ...onlinePeople };
    delete onlinePeopleExlOurUser[id];

    const messagesWithoutDupes = uniqBy(messages, '_id');

    return (
        <div className="flex h-screen">
            <div className="bg-blue-100 w-1/3 flex flex-col">
                <div className="flex-grow">
                    <Logo />
                    {Object.keys(onlinePeopleExlOurUser).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={true}
                            username={onlinePeopleExlOurUser[userId]}
                            onClick={() => { setSelectedUserId(userId) }}
                            selected={userId === selectedUserId} />
                    ))}
                    {Object.keys(offlinePeople).map(userId => (
                        <Contact
                            key={userId}
                            id={userId}
                            online={false}
                            username={offlinePeople[userId].username}
                            onClick={() => setSelectedUserId(userId)}
                            selected={userId === selectedUserId} />
                    ))}
                </div>
                <div className="p-2 text-center">
                    <span className="mr-2 text-sm text-gray-400">welcome&nbsp;
                        <span className="text-md text-black">{username}</span></span>
                    <button onClick={logout}
                        className="text-md bg-blue-100 py-0.5 px-2 text-gray-500 border border-black rounded-md" >
                        Logout</button>
                </div>
            </div>
            <div className="flex flex-col bg-blue-300 w-2/3 p-2">
                <div className="flex-grow">
                    {!selectedUserId && (
                        <div className="flex h-full flex-grow items-center justify-center">
                            <div className="text-black">&larr; Select a person from the sidebar</div>
                        </div>
                    )}
                    {!!selectedUserId && (
                        <div className="relative h-full">
                            <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-4">
                                {messagesWithoutDupes.map(message => (
                                    <div key={message._id} className={(message.sender === id ? 'text-right' : 'text-left')}>
                                        <div className={"inline-block p-2 my-2 rounded-md text-sm " + (message.sender === id ? 'bg-blue-500 text-white' : 'bg-white text-gray-500')}>
                                            {/* sender: {message.sender}<br/>
                                        my id:{id}<br/> */}
                                            {message.text}
                                            {message.file && (
                                                <div>
                                                    <a href={axios.defaults.baseURL + '/uploads/' + message.file}>
                                                        {message.file}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div ref={divUnderMessages}></div>
                            </div>
                        </div>
                    )}
                </div>
                {!!selectedUserId && (
                    <form className="flex gap-2" onSubmit={sendMessage}>
                        <input type="text" value={newMessageText}
                            onChange={ev => setNewMessageText(ev.target.value)} placeholder="Type your message here" className="bg-white flex-grow border p-2 rounded-sm" />
                        <label type="button" className="cursor-pointer">
                            <input type="file" className="hidden" onChange={sendFile}/>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                                <path fillRule="evenodd" d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z" clipRule="evenodd" />
                            </svg>

                        </label>
                        <button type="submit" className=" bg-blue-500 p-2 text-white rounded-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                            </svg>

                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}